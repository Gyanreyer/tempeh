package main

import (
	"encoding/json"
	"net"
	"net/http"
	"os"
	"strconv"
)

type TmphNode struct {
	TagName          string            `json:"tagName,omitempty"`
	StaticAttributes []StaticAttribute `json:"staticAttributes,omitempty"`
	RenderAttributes []RenderAttribute `json:"renderAttributes,omitempty"`
	Children         []*TmphNode       `json:"children,omitempty"`
	TextContent      string            `json:"textContent,omitempty"`
	Position         string            `json:"position"`
}

type AssetBucketStyle struct {
	Content  string `json:"content,omitempty"`
	Path     string `json:"path,omitempty"`
	Position string `json:"position"`
}

type AssetBucketScript struct {
	Content  string `json:"content,omitempty"`
	Path     string `json:"path,omitempty"`
	Scope    string `json:"scope"`
	Position string `json:"position"`
}

type TmphAssetBucket struct {
	Scripts []AssetBucketScript `json:"scripts,omitempty"`
	Styles  []AssetBucketStyle  `json:"styles,omitempty"`
}

type TmphAssetBucketMap map[string]*TmphAssetBucket

type ComponentImport struct {
	ImportName string `json:"importName,omitempty"`
	Path       string `json:"path"`
	Position   string `json:"position"`
}

type Component struct {
	RootNode       *TmphNode       `json:"rootNode"`
	HasDefaultSlot bool            `json:"hasDefaultSlot"`
	NamedSlots     map[string]bool `json:"namedSlots,omitempty"`
	PropTypesJSDoc string          `json:"propTypesJSDoc,omitempty"`
}

type TemplateData struct {
	MainComponent    *Component            `json:"mainComponent,omitempty"`
	InlineComponents map[string]*Component `json:"inlineComponents,omitempty"`
	Assets           TmphAssetBucketMap    `json:"assets,omitempty"`
	ComponentImports []ComponentImport     `json:"componentImports,omitempty"`
}

const DEFAULT_BUCKET_NAME = "default"

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

	rootNode := &TmphNode{
		Children: make([]*TmphNode, 0),
		Position: "1:1",
	}
	mainComponent := &Component{
		RootNode:       rootNode,
		HasDefaultSlot: false,
		NamedSlots:     make(map[string]bool),
		PropTypesJSDoc: "",
	}
	templateData := &TemplateData{
		MainComponent:    mainComponent,
		InlineComponents: make(map[string]*Component),
		Assets:           make(TmphAssetBucketMap),
		ComponentImports: make([]ComponentImport, 0),
	}

	parseElementChildren(rootNode, fileStr, false, 1, 1, mainComponent, templateData)

	return json.Marshal(templateData)
}
