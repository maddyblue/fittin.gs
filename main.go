package main

import (
	"bytes"
	"database/sql"
	"encoding/gob"
	"flag"
	"fmt"
	"log"
	"net/http"
	"net/url"
	"os"
	"strings"

	"github.com/jmoiron/sqlx"
	"github.com/kelseyhightower/envconfig"
	yaml "gopkg.in/yaml.v2"
)

var (
	flagParse        = flag.String("parse", "", "JSON file to parse")
	flagProcess      = flag.Bool("process", false, "processed unprocessed killmails")
	flagCreateTables = flag.Bool("create-tables", false, "create tables")
)

type Specification struct {
	Port    string `default:"4001"`
	DB_Addr string `default:"postgres://root@localhost:26257/ef?sslmode=disable"`
}

func main() {
	flag.Parse()

	var spec Specification
	err := envconfig.Process("", &spec)
	if err != nil {
		log.Fatal(err.Error())
	}
	if !strings.Contains(spec.Port, ":") {
		spec.Port = fmt.Sprintf(":%s", spec.Port)
	}

	dbURL, err := url.Parse(spec.DB_Addr)
	if err != nil {
		log.Fatal(err)
	}

	// TODO: disable debug in prod
	db := mustInitDB(dbURL.String())
	defer db.Close()
	if err := db.Ping(); err != nil {
		log.Fatal(err)
	}
	fmt.Println("inited", dbURL)

	s := &EFContext{
		DB: db,
		X:  sqlx.NewDb(db, "postgres"),
	}

	s.Init()

	if *flagCreateTables {
		s.CreateTables()
	}

	if *flagParse != "" {
		s.Parse(*flagParse)
		return
	}

	go s.FetchHashes()
	go s.ProcessHashes()
	go s.ProcessFits()
	go s.ProcessZkb()

	mux := http.NewServeMux()
	mux.Handle("/api/Fit", s.Wrap(s.Fit))
	mux.Handle("/api/Fits", s.Wrap(s.Fits))
	mux.Handle("/api/Search", s.Wrap(s.Search))
	mux.HandleFunc("/healthz", func(w http.ResponseWriter, r *http.Request) {})
	mux.Handle("/", http.FileServer(http.Dir("static")))

	fmt.Println("HTTP listen on addr:", spec.Port)
	log.Fatal(http.ListenAndServe(spec.Port, mux))
}

func (s *EFContext) Init() {
	const globalKey = "global"

	if _, err := s.DB.Exec(`CREATE TABLE IF NOT EXISTS config (key string primary key, val bytes)`); err != nil {
		panic(err)
	}

	var raw []byte
	if err := s.DB.QueryRow(`SELECT val FROM config WHERE key = $1`, globalKey).Scan(&raw); err == sql.ErrNoRows {
		{
			fmt.Println("reading groupIDs.yaml")
			r, err := os.Open("sde/fsd/groupIDs.yaml")
			if err != nil {
				panic(err)
			}
			defer r.Close()
			var yml map[int32]struct {
				CategoryID int32 `yaml:"categoryID"`
				Name       map[string]string
			}
			if err := yaml.NewDecoder(r).Decode(&yml); err != nil {
				panic(err)
			}
			s.Global.Groups = map[int32]Group{}
			for id, m := range yml {
				s.Global.Groups[id] = Group{
					ID:       id,
					Name:     m.Name["en"],
					Category: m.CategoryID,
				}
			}
		}
		{
			fmt.Println("reading types.yaml")
			r, err := os.Open("sde/fsd/typeIDs.yaml")
			if err != nil {
				panic(err)
			}
			defer r.Close()
			var yml map[int32]struct {
				GroupID int32 `yaml:"groupID"`
				Name    map[string]string
			}
			if err := yaml.NewDecoder(r).Decode(&yml); err != nil {
				panic(err)
			}
			s.Global.Items = map[int32]Item{}
			for id, m := range yml {
				s.Global.Items[id] = Item{
					ID:    id,
					Group: m.GroupID,
					Name:  m.Name["en"],
				}
			}
		}
		var b bytes.Buffer
		if err := gob.NewEncoder(&b).Encode(s.Global); err != nil {
			panic(err)
		}
		if _, err := s.DB.Exec(`UPSERT INTO config (key, val) VALUES ($1, $2)`, globalKey, b.Bytes()); err != nil {
			panic(err)
		}
		fmt.Println("config update")
	} else if err != nil {
		panic(err)
	} else {
		if err := gob.NewDecoder(bytes.NewReader(raw)).Decode(&s.Global); err != nil {
			panic(err)
		}
	}
}

type EFContext struct {
	DB *sql.DB
	X  *sqlx.DB

	Global struct {
		Items  map[int32]Item
		Groups map[int32]Group
	}
}

type Group struct {
	ID       int32
	Name     string
	Category int32
}

func (g Group) IsCharge() bool {
	return g.Category == 8
}

func (g Group) IsModule() bool {
	return g.Category == 7
}

func (g Group) IsShip() bool {
	return g.Category == 6
}

type Item struct {
	ID    int32  `json:",omitempty"`
	Name  string `json:",omitempty"`
	Group int32  `json:"-"`
}
