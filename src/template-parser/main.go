package main

import (
	"encoding/json"
	"log"
	"net/http"
	"os"
)

type TmphNode struct {
	TagName          string            `json:"tagName,omitempty"`
	StaticAttributes []StaticAttribute `json:"staticAttributes,omitempty"`
	RenderAttributes []RenderAttribute `json:"renderAttributes,omitempty"`
	Children         []*TmphNode       `json:"children,omitempty"`
	TextContent      string            `json:"textContent,omitempty"`
	Position         string            `json:"position"`
	Parent           *TmphNode         `json:"-"`
}

type AssetBucketStyle struct {
	Content  string `json:"content"`
	Position string `json:"position"`
}

type AssetBucketScript struct {
	Content  string `json:"content"`
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

type ParsedTemplateData struct {
	Nodes            *TmphNode                      `json:"nodes"`
	Assets           TmphAssetBucketMap             `json:"assets,omitempty"`
	HasDefaultSlot   bool                           `json:"hasDefaultSlot"`
	NamedSlots       []string                       `json:"namedSlots,omitempty"`
	ComponentImports []ComponentImport              `json:"componentImports,omitempty"`
	PropTypesJSDoc   string                         `json:"propTypesJSDoc,omitempty"`
	InlineComponents map[string]*ParsedTemplateData `json:"inlineComponents,omitempty"`
	CurrentLeaf      *TmphNode                      `json:"-"`
}

const DEFAULT_BUCKET_NAME = "default"

func main() {
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

	log.Fatal(http.ListenAndServe("localhost:8674", nil))
}

func parseTemplateFile(templateFilePath string) (parsedJSON []byte, err error) {
	fileBytes, err := os.ReadFile(templateFilePath)

	if err != nil {
		panic(err)
	}

	fileStr := string(fileBytes)

	cursor := &Cursor{index: 0, str: fileStr, maxIndex: len(fileStr) - 1, line: 1, column: 1}

	rootPosition := cursor.GetPosition()

	rootNode := &TmphNode{
		Children: make([]*TmphNode, 0),
		Position: rootPosition,
	}
	templateData := &ParsedTemplateData{
		Nodes:            rootNode,
		Assets:           make(TmphAssetBucketMap),
		HasDefaultSlot:   false,
		NamedSlots:       make([]string, 0),
		ComponentImports: make([]ComponentImport, 0),
		PropTypesJSDoc:   "",
		InlineComponents: make(map[string]*ParsedTemplateData, 0),
		CurrentLeaf:      rootNode,
	}

	for !cursor.IsAtEnd() {
		parseTemplateContent(cursor, false, templateData, templateData)
	}

	return json.Marshal(templateData)
}
