# Tempeh

An HTML-first templating language which lets you do what you want.

## ⚠️ This is not a real usable templating language... yet? ⚠️

Currently, this language just exists as an extremely work-in-progress spec representing my dream templating language.

I am taking on this exercise because I have found pretty much every templating language I've looked at to be lacking in some way.

In my opinion, one of the biggest deficiencies of most languages is a lack of care for the developer experience of authoring CSS, so scoped inline styles are a first-class high priority of this language.

This language is heavily influenced by 11ty's WebC, but tries to address some of the pain points I had
with that, particularly when it comes to composing components and type safety.

## How does the rendering API work?

My initial rough vision would be for templates to be defined in `.tmph.html` files which are then compiled into JavaScript files. These JavaScript files can then be imported into your project and used to render that component. HTML fragments can easily be rendered as well for use with HTMX. It might look something like this:

```html
<!-- components/List.tmph.html -->
<ul>
  <li #for:item="props.items" #text="item"></li>
</ul>
```

```js
import List from '../components/list.tmph';

/**
 * Rendered output:
 * <ul>
 *   <li>a</li>
 *   <li>b</li>
 *   <li>c</li>
 * </ul>
 */
List.render({
  props: {
    items: ["a", "b", "c"],
  },
});
```

You can also compose templates if the template has a `<slot>`.

```html
<!-- components/Section.tmph.html -->
<section>
  <slot></slot>
</section>
```

```js
import Section from '../components/Section.tmph';

/**
 * Rendered output:
 * <section>Text content</section>
 */
Section.render({
  slot: "Text content",
});

/**
 * Rendered output:
 * <section>
 *  <ul>
 *    <li>a</li>
 *    <li>b</li>
 *  </ul>
 * </section>
 */
Section.render({
  slot: List.render({
    props: {
      items: ["a", "b"],
    },
  }),
});
```

Named slots are also supported by adding a `namedSlots` object whose keys map to slot names and the values are the content that should be placed in that slot.

```html
<!-- components/Section.tmph.html -->
<section>
  <h3>
    <slot name="heading"></slot>
  </h3>
  <p>
    <slot></slot>
  </p>
</section>
```

```js
import Section from '../components/Section.tmph';

/**
 * Rendered output:
 * <section>
 *   <h3>My title</h3>
 *   <p>My content</p>
 * </section>
 */
Section.render({
  slot: "My content",
  namedSlots: {
    heading: "My title",
  },
});
```

## Template syntax

### Comments

Standard HTML comment syntax is always allowed:

```html
<!-- Clicking this button does something -->
<button>Click me</button>
```

However, HTML comments are limited in that they cannot be written inside of the markup for an HTML tag,
meaning it's harder to annotate specific attributes or props on an element. Tempeh allows you to do this
with a `#` attribute which accepts a string with whatever comments you want to add.
This attribute will be stripped from the final rendered HTML.

```html
<button
  #="This button is disabled when props.isDisabled is true"
  :disabled="props.isDisabled"
  #="
    You can have as many comments on the same tag as you like.
    They can even go onto multiple lines.
  "
>Click me</button>
```

### Un-tagged attributes will just be directly evaluated as strings

```html
<!-- Div.tmph.html -->
<div class="hi" data-val="props.value" />

<!-- Div.render({
  props: {
    value: "hi"
  },
}) -->
<div class="hi" data-val="props.value"></div>
```

### Attributes tagged with a `:` take a JavaScript expression and set the attribute on the element with the expression's evaluated return value

```html
<!-- Div.tmph.html -->
<div :class="props.isDisabled ? 'disabled' : 'enabled'" />

<!-- Div.render({ 
  props: {
    isDisabled: true,
  },
}); -->
<div class="disabled"></div>

<!-- Div.render({ 
  props: {
    isDisabled: false,
  },
}); -->
<div class="enabled"></div>
```

### Spreading attributes

You may also spread an object's key/value pairs as attributes on an element using a `:...` attribute:

```html
<!-- Div.tmph.html -->
<div :...="props"></div>

<!-- Div.render({
  props: {
    class: "hello",
    id: "my-id",
    data-testid: "test-id",
  },
}); -->
<div class="hello" id="my-id" data-testid="test-id"></div>
```

### Attributes tagged with a `$` are reserved for special Tempeh functions which can dynamically modify an element's content

#### `$textContent`

A `$textContent` attribute takes a JavaScript expression which evaluates to a string. The string will be sanitized to
escape any potential HTML tags for security purposes.
You may also use `$text` as a shorthand.

```html
<!-- Heading.tmph.html -->
<h1 $textContent="props.heading" />
<p $text="props.subHeading" />

<!-- Heading.render({
  heading: "My Heading",
  subHeading: "My <script>console.log('gotcha!')</script> text",
}) -->
<h1>My Heading</h1>
<p>My &lt;script&gt;console.log(&#039;gotcha!&#039;)&lt;/script&gt; text</p>
```

#### `$innerHTML`

A `$innerHTML` attribute takes a JavaScript expression which evaluates to an HTML string. The string will not be sanitized, so be
careful about using this for content from untrusted sources as it could expose you to XSS attacks.
You may also use `$html` as a shorthand.

```html
<!-- Heading.tmph.html -->
<h1 $innerHTML="props.heading" />

<!-- Heading.render({
  heading: "This title has <em>emphasis</em>",
}) -->
<h1>This title has <em>emphasis</em></h1>
```

#### `$tagName`

A `$tagName` attribute takes a JavaScript expression which evaluates to a string. This value will be used to override the element's tag name
with a custom string. Note that capitalization in the provided string will be ignored and transformed to all-lowercase.

```html
<!-- Heading.tmph.html -->
<h1 $tagName="`h${props.level}`">
  <slot></slot>
</h1>

<!-- Heading.render({
  props: {
    level: 3,
  },
  slots:
   }, "My Heading") -->
<h3>My Heading</h3>
```

### Attributes tagged with a `#` are reserved for special Tempeh template functions related to rendering logic

#### `#for:{item}`

You can use the `#for` attribute to render an element and its children for each item in an iterable list.

The attribute name should include a colon-separated attribute modifier which defines the
variable name that you can reference each item in the list with. You can also optionally add a comma and additional variable name which will map to the item's index.

The attribute value should be a JavaScript expression which evaluates to an interable value such as an Array.

```html
<!-- list.tmph.html -->
<ul>
  <li #for:listItem,i="props.items" :data-index="i">
    <h3 $textContent="listItem.title" />
    <p $textContent="listItem.body" />
  </li>
</ul>

<!-- list.render({
       items: [
         {
           title: "Item 1",
           body: "This is some text",
         },
         {
           title: "Item 2",
           body: "Hello, world!",
         },
       ],
     }) -->
<ul>
  <li data-index="0">
    <h3>Item 1</h3>
    <p>This is some text</p>
  </li>
  <li data-index="1">
    <h3>Item 2</h3>
    <p>Hello, world!</p>
  </li>
</ul>
```

##### `#for-range:{index}`

For cases where you just need to arbitrarily loop a certain number of times, you can use the `#for-range` attribute.
The attribute should take a JavaScript expression which evaluates to an array of 2 integers representing the start and end index of the range (both inclusive).

If the start index is higher than the end, the loop will count down instead of up.

For even more advanced cases where you may wish to skip certain parts of a range, you may instead provide an array of range arrays.

```html
<ol>
  <li #for-range:i="[0, 2]" #text="i" />
</ol>
<ol>
  <li
    #="Count up to 3 and then back down to 1"
    #for-range:i="[[1,3], [2,1]]" #text="i"
  />
</ol>

<!-- Rendered result -->
<ol>
  <li>0</li>
  <li>1</li>
  <li>2</li>
</ol>
<ol>
  <li>1</li>
  <li>2</li>
  <li>3</li>
  <li>2</li>
  <li>1</li>
</ol>
```

#### `#if`

A `#if` attribute takes a JavaScript expression which should evaluate to either true or false. If true, the element will be rendered, otherwise it will not.

This attribute will be stripped from the rendered output.

```html
<!-- div.tmph.html -->
<div>
  <p #if="props.shouldRender">
    I was rendered
  </p>
</div>

<!-- div.render({ shouldRender: true }) -->
<div>
  <p>I was rendered</p>
</div>

<!-- div.render({ shouldRender: true }) -->
<div>
</div>
```

#### `#with:{var}`

You can set a `#with` attribute on an element with an attribute modifier for a variable name
to declare a scoped variable whose value will be available on that element and all of its children.

This can be useful for pre-computing values which are re-used multiple times in the template.

```html
<!-- example.tmph.html -->
<div #with:id="props.getItem().id" :id="id">
  <p $textContent="`My ID is ${id}`" />
</div>

<!-- example.render({
  getItem(){
    return {
      id: "asdf-1234",
    };
  }
}) -->
<div id="asdf-1234">
  <p>My ID id "asdf-1234"</p>
</div>
```

### Template Fragments

You may define a "template fragment" using a `<_>` tag.
Like the concept of fragments in JSX, the contents of the `<_>` will be included in the final output, but the `<_>`
tag itself will be removed. This can be useful for scenarios where you want to insert some dynamic
content without having to wrap it in an extra element.
Template fragments can still have `#` template render attributes applied to them.

```html
<p>
  Hello! Here is some dynamic text: <template $textContent="props.dynamicText" />
  <_ #if="props.shouldShowSecondLine">
    <br/>And here's another line of text!
  </_>
</p>
<_ #for-range:i="[0, 10]" #text="i" />
```

## Scripts

### Data types

You can declare typings for a template's render function.

```html
<script #types>
  /**
   * @param {Object}    props
   * @param {number[]}  [props.items=[]]
   */
</script>
```

### Pre-calculated data with JavaScript

You can write scripts to pre-calculate complex data for the component.

```html
<script #data>
  export const data = await fetch("https://example.com/value").then((res) => res.json());
</script>
<div $text="data.name"></div>
```

By default, a `#data` script will re-run for every instance where the component is rendered. You can add a `#cache` attribute to indicate that it should only be run once
and the result should then be cached for all instances
of the component.

```html
<script #data #cache>
  // This value will only be fetched once when rendering even if the component is
  // rendered multiple times
  export const data = await fetch("https://example.com/value").then((res) => res.json());
</script>
<div $text="data.name"></div>
```

### Rendering HTML with JavaScript

HTML can be dynamically rendered with JavaScript by marking up a `<script>` tag with a `#render` attribute.
Render scripts should return an HTML string which will replace the `<script>` tag in the final rendered output.
A render script may also return a falsey value (ie, `null`, `undefined`, `false`), which will result in nothing being rendered.
Async code is allowed, and the script may directly return a Promise as well as long as it resolves to a valid value.

```html
<p>
  Hi, my name is
  <script #render>
    const value = await fetch("https://example.com/value").then((res) => res.json());

    return /* html */`
      <strong>
        ${value.name}
      </strong>
    `;
  </script>
</p>

<!-- Rendered result where https://example.com/value responds with JSON "{ 'name': 'Bob' }" -->
<p>Hi, my name is <strong>Bob</strong></p>
```

Like with `#data` scripts, the results of `#render` scripts may also be
cached across all instances of a component by adding a `#cache` attribute.

### Scoped runtime scripts

You may scope runtime scripts to the component file to avoid global naming collisions by marking
up the `<script>` tag with `#scoped:component`.

Taking things a step further still, you may also scope runtime scripts to run for each individual instance of the component with `#scoped:instance`,
making it easier to perform setup like adding event listeners.

These scripts...

```html
<script #scoped:component>
  const observer = new IntersectionObserver((entries)=>{
    entries.forEach((entry)=>{
      if(entry.isIntersecting) {
        entry.target.opacity = 1;
      }
    });
  });
</script>
<script #scoped:instance>
  this.addEventListener("click", () => console.log("You clicked me!"));

  observer.observe(this);
</script>
```

will compile to...

```js
window.__tmphCmpScriptRegistry__ = {};

// Watch in case any new instances of the component get added to the DOM so we
// can run the setup script for them.
const componentMutationObserver = new MutationObserver((mutationList) => {
  for(const mutation of mutationList) {
    for(const node of mutation.addedNodes) {
      window.__tmphCmpScriptRegistry__[node.dataset.scid]?.call(node);
    }
  }
});
componentMutationObserver.observe(document.body, {
  childList: true,
});

{
  // List.tmph.html
  const observer = new IntersectionObserver((entries)=>{
    entries.forEach((entry)=>{
      if(entry.isIntersecting) {
        entry.target.opacity = 1;
      }
    });
  });

  window.__tmphCmpScriptRegistry["List-asdf"] = () => {
    this.addEventListener("click", () => console.log("You clicked me!"));
    observer.observe(this);
  };

  for(const node of document.querySelectorAll('[data-scid="List-asdf"]')) {
    window.__tmphCmpScriptRegistry["List-asdf"].call(node);
  }
}

```

## Styles

### Scoped styles

Styles in a `<style>` tag can be scoped within the component's root element(s) using the [`@scope` at-rule](https://developer.chrome.com/articles/at-scope/).

Any CSS wrapped inside an `@scope` rule will be transformed to scope all selectors within an auto-generated data attribute
that will be applied to all root elements of the component.

To select the root element, you may use a `:scope` selector.

```html
<!-- FancyLink.tmph.html -->
<a :href="props.href">
  <svg class="icon"></svg>
  <slot></slot>
</a>
<style>
  @scope {
    :scope {
      text-decoration: none;
      color: cornflowerblue;
    }

    :scope:hover {
      transform: scale(1.1);
    }

    .icon {
      width: 1rem;
      height: auto;
    }

    main :scope {
      /* Apply a style for all FancyLinks inside the <main> tag */
      color: red;
    }
  }
</style>

<!-- Rendered Output -->
<a href="/" data-scid="FancyLink-lsda21f">Home</a>
<style>
  [data-scid="FancyLink-lsda21f"] {
    text-decoration: none;
    color: cornflowerblue;
  }

  [data-scid="FancyLink-lsda21f"]:hover {
    transform: scale(1.1);
  }

  [data-scid="FancyLink-lsda21f"] .icon {
    width: 1rem;
    height: auto;
  }

  main [data-scid="FancyLink-lsda21f"] {
    color: red;
  }
</style>
```

For components with multiple root elements, you can pass the selector for a specific root element to `@scope`.

```html
<!-- Home.tmph.html -->
<header>
  <h1>Hello</h1>
  <p>Subtitle</p>
</header>
<main>
  <img src="logo.png" alt="Logo" />
</main>

<style>
  @scope(header) {
    :scope {
      display: flex;
      flex-direction: column;
    }
  
    h1 {
      font-size: 4rem;
    }
  
    p {
      font-size: 0.8rem;
    }
  }

  @scope(main) {
    img {
      display: block;
      width: 2rem;
    }
  }

</style>

<!-- Rendered output -->
<header data-scid="Home-hla3f23">
  <h1>Hello</h1>
  <p>Subtitle</p>
</header>
<main data-scid="Home-hla3f23">
  <img src="logo.png" alt="Logo" />
</main>
<style>
  [data-scid="Home-hla3f23"]header {
    display: flex;
    flex-direction: column;
  }

  [data-scid="Header-hla3f23"]header h1 {
    font-size: 4rem;
  }

  [data-scid="Header-hla3f23"]header p {
    font-size: 0.8rem;
  }

  [data-scid="Header-hla3f23"]main img {
    display: block;
    width: 2rem;
  }
</style>
```

The `@scope() to ()` syntax described in the CSS `@scope` spec which allows you to limit the scope
to elements outside of a given selector is not currently supported.

### External Stylesheets

An individual external stylesheet file will be generated for component styles marked with an `#external` attribute.
Each component instance will render a link to the stylesheet.

```html
<!--ListItem.tmph.html -->
<li><slot /></li>

<style #external>
  li {
    margin-left: 0;
  }
</style>
```

Outputs:

```html
<li data-scid="ListItem-a0283c"></li>
<link rel="stylesheet" href="/ListItem-a0283c.css" />
```

```css
/* ListItem-a0283c.css */
[data-scid="ListItem-a0283c"]li,
[data-scid="ListItem-a0283c"] li {
  margin-left: 0;
}
```

## Components

Each `.tmph.html` file can be thought of as a Tempeh component which can be imported and re-used in other component files.

### Importing components from other files

```html
<link rel="import" href="./MyComponent.tmph.html" />
<link rel="import" href="./OtherComponent.tmph.html" as="OtherName" />

<div>
  <MyComponent  />
  <OtherName />
</div>
```

### Attributes are passed through as values on the component's `props` object

```html
<ul>
  <ListItem :item="{ name: 'First' }" />
  <ListItem :item="{ name: 'Second' }" />
</ul>
```

### Declaring sub-components in the same file with `#component`

You can declare sub-components with a `<template>` tag with a `#component` flag. Sub-components can be re-used within
the component file but can't be imported by other component files. This can be useful if you wish to encapsulate a complex fragment
which gets re-used in multiple places throughout the component.

The `#component` attribute needs to be paired with an `id` attribute for the name of the component. This component name can then be referenced throughout the template.

```html
<!-- List.tmph.html -->
<template #component id="ListItem">
  <li>
    <p #text="props.item.name"></p>
  </li>
</template>

<ul>
  <ListItem :item="{ name: 'First' }" />
  <ListItem :item="{ name: 'Second' }" />
</ul>
```

You may also reference a sub-component in your import by referencing the component ID with a hash on the import path.

```html
<link rel="import" href="./List.tmph.html#ListItem" />
<ListItem :item="{ name: 'Hello!' }" />
```

## Markdown

An element can be marked so that its content will be processed as markdown with a
`#md` attribute. Tempeh components will still be resolved within the markdown to provide
a similar experience to MDX. "MDTMPH" doesn't roll off the tongue unfortunately.

```html
<main #md>
  # My Heading
  
  ## Subheading

  Here is a list:
  - Item one
  - Item two

  Tempeh components will still be rendered:

  <FancyButton>Click me!</FancyButton>
</main>

<!-- Rendered output: -->
<main>
  <h1>My heading</h1>
  <h2>Subheading</h2>
  <p>Here is a list:</p>
  <ul>
    <li>Item one</li>
    <li>Item two</li>
  </ul>
  <p>Tempeh components will still be rendered:</p>
  <button class="fancy-button">Click me!</FancyButton>
</main>
```
