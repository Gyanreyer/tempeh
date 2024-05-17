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

	http.HandleFunc("/health", func(responseWriter http.ResponseWriter, request *http.Request) {
		responseWriter.Write([]byte("OK"))
	})

	http.HandleFunc("/parse", func(responseWriter http.ResponseWriter, request *http.Request) {
		err := parseTemplateFile(request.URL.Query().Get("path"), &responseWriter)
		if err != nil {
			responseWriter.WriteHeader(http.StatusInternalServerError)
			responseWriter.Write([]byte(err.Error()))
		}
	})

	defer http.Serve(listener, nil)

	port := listener.Addr().(*net.TCPAddr).Port

	// Write the server's URL origin to stdout so that the parent process can read it
	// and know that the server is ready to receive requests at that address
	os.Stdout.Write([]byte("http://localhost:" + strconv.Itoa(port)))
}
