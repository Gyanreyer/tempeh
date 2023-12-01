package main

type RenderAttribute struct {
	AttributeName                string `json:"name"`
	AttributeModifier            string `json:"modifier,omitempty"`
	ExpressionValue              string `json:"expressionValue,omitempty"`
	DoesExpressionReferenceProps bool   `json:"doesExpressionReferenceProps,omitempty"`
	IsExpressionAsync            bool   `json:"isExpressionAsync,omitempty"`
	Position                     string `json:"position"`
}

type StaticAttribute struct {
	AttributeName  string `json:"name"`
	AttributeValue string `json:"value,omitempty"`
	Position       string `json:"position"`
}

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

func (node *TmphNode) GetRenderAttribute(attributeName string) (isSet bool, modifier string, value string) {
	for _, attribute := range node.RenderAttributes {
		if attribute.AttributeName == attributeName {
			return true, attribute.AttributeModifier, attribute.ExpressionValue
		}
	}

	return false, "", ""
}

func NewElementNode(tagName string, staticAttributes []StaticAttribute, renderAttributes []RenderAttribute, position string) *TmphNode {
	return &TmphNode{
		TagName:          tagName,
		StaticAttributes: staticAttributes,
		RenderAttributes: renderAttributes,
		Children:         []*TmphNode{},
		Position:         position,
	}
}

func NewTextNode(textContent string, position string) *TmphNode {
	return &TmphNode{
		TextContent: textContent,
		Position:    position,
	}
}

func NewRootNode(tagName string, position string) *TmphNode {
	return &TmphNode{
		TagName:  tagName,
		Children: make([]*TmphNode, 0),
		Position: position,
	}
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
	SourceFilePath   string                      `json:"sourceFilePath"`
	MainComponent    *Component                  `json:"mainComponent,omitempty"`
	InlineComponents map[string]*Component       `json:"inlineComponents,omitempty"`
	Assets           map[string]*TmphAssetBucket `json:"assets,omitempty"`
	ComponentImports []ComponentImport           `json:"componentImports,omitempty"`
}
