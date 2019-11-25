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
		{
			fmt.Println("reading groupIDs.yaml")
			r, err := os.Open("sde/fsd/groupIDs.yaml")
			if err != nil {
				panic(err)
			}
			defer r.Close()
			if err := yaml.NewDecoder(r).Decode(&s.Global.Groups); err != nil {
				panic(err)
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
