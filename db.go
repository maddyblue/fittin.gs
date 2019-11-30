package main

import (
	"context"
	"database/sql"
	"database/sql/driver"
	"fmt"
	"io"
	"log"
	"os/exec"
	"strconv"
	"strings"
	"sync"

	"github.com/lib/pq"
	servertiming "github.com/mitchellh/go-server-timing"
)

func mustInitDB(dataSource string) *sql.DB {
	const name = "postgres-log"
	sql.Register(name, drv{})
	db, err := sql.Open(name, dataSource)
	if err != nil {
		panic(err)
	}
	return db
}

func mustExec(db *sql.DB, query string, params ...interface{}) {
	if _, err := db.Exec(query, params...); err != nil {
		panic(err)
	}
}

type drv struct{}

func (d drv) Open(name string) (driver.Conn, error) {
	c, err := pq.Open(name)
	fmt.Println("LOG:", *flagLog)
	c = &conn{
		Conn: c,
		log:  *flagLog,
	}
	return c, err
}

func addTiming(ctx context.Context, name string, query string, args []driver.NamedValue) func() {
	esc := func(s string) string {
		// Reduce all internal whitespace.
		return strconv.Quote(
			strings.TrimSpace(
				strings.Join(
					strings.Fields(s),
					" ",
				),
			),
		)
	}
	m := servertiming.FromContext(ctx).NewMetric(name).Start()
	m.Desc = esc(query)
	return func() { m.Stop() }
}

// conn implements a logging driver.Conn that logs queries.
type conn struct {
	driver.Conn
	log bool
}

func (c *conn) logQuery(query string, args interface{}) {
	if !c.log {
		return
	}
	as := fmt.Sprint(args)
	if len(as) > 100 {
		as = as[:100] + "..."
	}
	log.Printf("Query: %v: %s", as, query)
}

func (c *conn) Prepare(query string) (driver.Stmt, error) {
	c.logQuery(query, "[prepare]")
	return c.Conn.Prepare(query)
}

func (c *conn) Begin() (driver.Tx, error) {
	c.logQuery("Begin()", nil)
	return c.Conn.Begin()
}

func (c *conn) BeginTx(ctx context.Context, opts driver.TxOptions) (driver.Tx, error) {
	c.logQuery("BeginTx()", nil)
	return c.Conn.(driver.ConnBeginTx).BeginTx(ctx, opts)
}

func (c *conn) QueryContext(
	ctx context.Context, query string, args []driver.NamedValue,
) (driver.Rows, error) {
	c.ExplainNamed(query, args)
	defer addTiming(ctx, "QUERY", query, args)()
	return c.Conn.(driver.QueryerContext).QueryContext(ctx, query, args)
}

func (c *conn) Query(query string, args []driver.Value) (driver.Rows, error) {
	c.Explain(query, args)
	return c.Conn.(driver.Queryer).Query(query, args)
}

func (c *conn) Exec(query string, args []driver.Value) (driver.Result, error) {
	c.logQuery(query, args)
	return c.Conn.(driver.Execer).Exec(query, args)
}

func (c *conn) ExecContext(
	ctx context.Context, query string, args []driver.NamedValue,
) (sql.Result, error) {
	c.logQuery(query, args)
	defer addTiming(ctx, "EXEC", query, args)()
	return c.Conn.(driver.ExecerContext).ExecContext(ctx, query, args)
}

func (c *conn) ExplainNamed(query string, args []driver.NamedValue) {
	values := make([]driver.Value, len(args))
	for i, v := range args {
		values[i] = v.Value
	}
	c.Explain(query, values)
}

var outputLock sync.Mutex

func sqlfmt(query string) string {
	out, err := exec.Command("./cockroach", "sqlfmt", "-e", query).Output()
	if err == nil {
		return string(out)
	}
	return query
}

func (c *conn) Explain(query string, args []driver.Value) {
	if !c.log {
		return
	}
	outputLock.Lock()
	fmt.Print(sqlfmt("explain "+query), args, "\n")
	if err := func() error {
		rows, err := c.Conn.(driver.Queryer).Query("EXPLAIN "+query, args)
		if err != nil {
			return err
		}
		defer rows.Close()
		var level int64
		var typ, field, description string
		values := []driver.Value{level, typ, field, description}
		for {
			if err := rows.Next(values); err == io.EOF {
				return nil
			} else if err != nil {
				return err
			}
			fmt.Print("\t", values, "\n")
		}
	}(); err != nil {
		fmt.Println(err)
	}
	if err := func() error {
		rows, err := c.Conn.(driver.Queryer).Query("EXPLAIN ANALYZE (distsql) "+query, args)
		if err != nil {
			return err
		}
		defer rows.Close()
		var level int64
		var typ, field, description string
		values := []driver.Value{level, typ, field, description}
		for {
			if err := rows.Next(values); err == io.EOF {
				return nil
			} else if err != nil {
				return err
			}
			fmt.Println("EXPLAIN ANALYZE (distsql)", values)
		}
	}(); err != nil {
		fmt.Println(err)
	}
	outputLock.Unlock()
}
