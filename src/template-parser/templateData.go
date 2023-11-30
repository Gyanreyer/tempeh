package main

type TmphNode struct {
	TagName          string            `json:"tagName,omitempty"`
	StaticAttributes []StaticAttribute `json:"staticAttributes,omitempty"`
	RenderAttributes []RenderAttribute `json:"renderAttributes,omitempty"`
	Children         []*TmphNode       `json:"children,omitempty"`
	TextContent      string            `json:"textContent,omitempty"`
	Position         string            `json:"position"`
}

func (node *TmphNode) AppendChild(child *TmphNode) {
	node.Children = append(node.Children, child)
}

func (node *TmphNode) GetStaticAttribute(attributeName string) (isSet bool, value string) {
	for _, attribute := range node.StaticAttributes {
		if attribute.AttributeName == attributeName {
			return true, attribute.AttributeValue
		}
	}

	return false, ""
}

func (node *TmphNode) GetRenderAttribute(attributeName string) (isSet bool, value string, modifier string) {
	for _, attribute := range node.RenderAttributes {
		if attribute.AttributeName == attributeName {
			return true, attribute.AttributeValue, attribute.AttributeModifier
		}
	}

	return false, "", ""
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
