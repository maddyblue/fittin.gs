package main

import (
	"bytes"
	"compress/gzip"
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"

	servertiming "github.com/mitchellh/go-server-timing"
	"github.com/pkg/errors"
)

func (s *EFContext) Wrap(
	f func(context.Context, *http.Request) (interface{}, error),
) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodOptions {
			w.Header().Set("Access-Control-Allow-Origin", "*")
			w.Header().Set("Access-Control-Allow-Methods", "GET")
			w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
			w.Header().Set("Access-Control-Max-Age", "3600")
			w.WriteHeader(http.StatusNoContent)
			return
		}
		w.Header().Set("Access-Control-Allow-Origin", "*")

		ctx, cancel := context.WithTimeout(r.Context(), time.Second*60)
		defer cancel()
		var sh servertiming.Header
		ctx = servertiming.NewContext(ctx, &sh)
		if v, err := url.ParseQuery(r.URL.RawQuery); err == nil {
			r.URL.RawQuery = v.Encode()
		}
		url := r.URL.String()
		start := time.Now()
		defer func() { fmt.Printf("%s: %s\n", url, time.Since(start)) }()
		tm := servertiming.FromContext(ctx).NewMetric("req").Start()
		res, err := f(ctx, r)
		tm.Stop()
		if len(sh.Metrics) > 0 {
			if len(sh.Metrics) > 10 {
				sh.Metrics = sh.Metrics[:10]
			}
			w.Header().Add(servertiming.HeaderKey, sh.String())
		}
		if err != nil {
			log.Printf("%s: %+v", url, err)
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		data, gzip, err := resultToBytes(res)
		if err != nil {
			log.Printf("%s: %v", url, err)
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		writeDataGzip(w, r, data, gzip)
	}
}

func (s *EFContext) Fit(ctx context.Context, r *http.Request) (interface{}, error) {
	id := r.FormValue("id")
	if id == "" {
		return nil, errors.New("missing fit id")
	}

	var rawKM, rawZKB []byte
	var kmid int32
	if err := s.DB.QueryRowContext(ctx, `SELECT id, km, zkb from killmails where id = $1`, id).Scan(&kmid, &rawKM, &rawZKB); err != nil {
		return nil, err
	}
	var km KM
	err := json.Unmarshal(rawKM, &km)
	var zkb Zkb
	json.Unmarshal(rawZKB, &zkb)
	hi, med, low, rig, sub := km.Items(s)
	return struct {
		Killmail               int32
		Zkb                    Zkb
		Ship                   Item
		Hi, Med, Low, Rig, Sub [8]ItemCharge
	}{
		Killmail: kmid,
		Zkb:      zkb,
		Ship:     s.Global.Items[km.Victim.ShipTypeId],
		Hi:       hi,
		Med:      med,
		Low:      low,
		Rig:      rig,
		Sub:      sub,
	}, err
}

func (s *EFContext) Fits(ctx context.Context, r *http.Request) (interface{}, error) {
	var ret struct {
		Filter map[string][]Item
		Fits   []*struct {
			Killmail int
			Ship     int32
			Name     string
			Cost     int64
			HiRaw    []byte `json:"-"`
			Hi       []Item
		}
	}
	ret.Filter = map[string][]Item{}
	r.ParseForm()

	var sb strings.Builder
	sb.WriteString(`SELECT killmail, ship, cost, hi AS hiraw FROM fits WHERE true`)
	var args []interface{}
	if ship, _ := strconv.Atoi(r.Form.Get("ship")); ship > 0 {
		args = append(args, ship)
		fmt.Fprintf(&sb, " AND ship = $%d", len(args))
		ret.Filter["ship"] = append(ret.Filter["ship"], s.Global.Items[int32(ship)])
	}
	var items []string
	for _, item := range r.Form["item"] {
		itemid, _ := strconv.Atoi(item)
		if itemid <= 0 {
			continue
		}
		items = append(items, item)
		ret.Filter["item"] = append(ret.Filter["item"], s.Global.Items[int32(itemid)])
	}
	if len(items) > 0 {
		args = append(args, fmt.Sprintf(`[%s]`, strings.Join(items, ", ")))
		fmt.Fprintf(&sb, " AND items @> $%d", len(args))
	}
	sb.WriteString(` ORDER BY killmail DESC`)
	sb.WriteString(` LIMIT 100`)

	err := s.X.SelectContext(ctx, &ret.Fits, sb.String(), args...)
	for _, f := range ret.Fits {
		f.Name = s.Global.Items[f.Ship].Name
		var his []int32
		json.Unmarshal(f.HiRaw, &his)
		for _, h := range his {
			item := s.Global.Items[h]
			if s.Global.Groups[item.Group].IsCharge() {
				continue
			}
			f.Hi = append(f.Hi, item)
		}
	}
	return ret, err
}

var searchCategories = map[int32]string{
	6:  "ship",
	7:  "item", // module
	8:  "item", // charge
	32: "item", // subsystem
}

func (s *EFContext) Search(ctx context.Context, r *http.Request) (interface{}, error) {
	type Result struct {
		Type string
		Name string
		ID   int32
	}
	var ret struct {
		Search  string
		Results []Result
	}
	ret.Search = strings.ToLower(r.FormValue("term"))
	if len(ret.Search) < 3 {
		return nil, nil
	}
	if ret.Search != "" {
		for id, item := range s.Global.Items {
			if !strings.Contains(strings.ToLower(item.Name), ret.Search) {
				continue
			}
			if typ := searchCategories[s.Global.Groups[item.Group].Category]; typ != "" {
				ret.Results = append(ret.Results, Result{
					Type: typ,
					Name: item.Name,
					ID:   id,
				})
			}
		}
	}
	return ret, nil
}

func resultToBytes(res interface{}) (data, gzipped []byte, err error) {
	data, err = json.Marshal(res)
	if err != nil {
		return nil, nil, errors.Wrap(err, "json marshal")
	}
	var gz bytes.Buffer
	gzw, _ := gzip.NewWriterLevel(&gz, gzip.BestCompression)
	if _, err := gzw.Write(data); err != nil {
		return nil, nil, errors.Wrap(err, "gzip")
	}
	if err := gzw.Close(); err != nil {
		return nil, nil, errors.Wrap(err, "gzip close")
	}
	return data, gz.Bytes(), nil
}

func writeDataGzip(w http.ResponseWriter, r *http.Request, data, gzip []byte) {
	w.Header().Add("Content-Type", "application/json")
	w.Header().Add("Cache-Control", "max-age=3600")
	if strings.Contains(r.Header.Get("Accept-Encoding"), "gzip") {
		w.Header().Add("Content-Encoding", "gzip")
		w.Write(gzip)
	} else {
		w.Write(data)
	}
}
