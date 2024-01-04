package main

import (
	"net"
	"net/http"
	"os"
	"strconv"

	gen "github.com/gyanreyer/tempeh/template-parser/pb/gen/go"
	"google.golang.org/protobuf/proto"
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

func parseTemplateFile(templateFilePath string) (templateDataBytes []byte, err error) {
	fileBytes, err := os.ReadFile(templateFilePath)

	if err != nil {
		return nil, err
	}

	fileStr := string(fileBytes)

	childNodeChannel := make(chan []*gen.TmphNode)

	go parseElementChildren(childNodeChannel, fileStr, false, 1, 1)

	parsedTemplateNodes := <-childNodeChannel

	templateDataBytes, err = proto.Marshal(&gen.TemplateData{
		Src:   templateFilePath,
		Nodes: parsedTemplateNodes,
	})

	if err != nil {
		return nil, err
	}

	return templateDataBytes, nil
}
