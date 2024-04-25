package main

import (
	"net"
	"net/http"
	"os"
	"strconv"
)

func main() {
	listener, err := net.Listen("tcp", "localhost:0")

	if err != nil {
		panic(err)
	}

	http.HandleFunc("/parse", func(w http.ResponseWriter, r *http.Request) {
		parsedTemplateDataBytes, err := parseTemplateFile(r.URL.Query().Get("path"))
		if err != nil {
			w.WriteHeader(http.StatusInternalServerError)
			w.Write([]byte(err.Error()))
		} else {
			w.WriteHeader(http.StatusOK)
			w.Write(parsedTemplateDataBytes)
		}
	})

	defer http.Serve(listener, nil)

	port := listener.Addr().(*net.TCPAddr).Port

	// Write the server's URL origin to stdout so that the parent process can read it
	// and know that the server is ready to receive requests at that address
	os.Stdout.Write([]byte("http://localhost:" + strconv.Itoa(port)))
}
