package main

import (
	"encoding/json"
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
		parsedJSON, err := parseTemplateFile(r.URL.Query().Get("path"))
		if err != nil {
			w.WriteHeader(http.StatusInternalServerError)
			w.Write([]byte(err.Error()))
		} else {
			w.WriteHeader(http.StatusOK)
			w.Write(parsedJSON)
		}
	})

	defer http.Serve(listener, nil)

	port := listener.Addr().(*net.TCPAddr).Port

	// Write the server's URL origin to stdout so that the parent process can read it
	// and know that the server is ready to receive requests at that address
	os.Stdout.Write([]byte("http://localhost:" + strconv.Itoa(port)))
}

func parseTemplateFile(templateFilePath string) (parsedJSON []byte, err error) {
	fileBytes, err := os.ReadFile(templateFilePath)

	if err != nil {
		panic(err)
	}

	fileStr := string(fileBytes)

	rootNode := NewRootNode("_", "1:1")
	mainComponent := &Component{
		RootNode:       rootNode,
		HasDefaultSlot: false,
		NamedSlots:     make(map[string]bool),
		PropTypesJSDoc: "",
	}
	templateData := &TemplateData{
		SourceFilePath:   templateFilePath,
		MainComponent:    mainComponent,
		InlineComponents: make(map[string]*Component),
		Assets:           make(map[string]*TmphAssetBucket),
		ComponentImports: make([]ComponentImport, 0),
	}

	parseElementChildren(rootNode, fileStr, false, mainComponent, templateData, 1, 1)

	return json.Marshal(templateData)
}
