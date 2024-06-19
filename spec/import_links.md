# Import Links

You can import other Tempeh files for component composition using `<link rel="import">`.

## `href`

The `href` attribute is required. This must point to a file path for an existing valid Tempeh template file.
This path can either be relative to the importing file or absolute as defined in your .tmph.config.js file. (TODO: this is not specced out yet.)

## `as`

You can optionally provide an `as` attribute on an import link to specify the name which the imported component can be referred to by.

If no `as` attribute is specified, the name of the imported component will be inferred from the file name in PascalCase,
ie `simpleList.tmph.html` -> `SimpleList`.

Example with no import `as` name specified:

```html
<link rel="import" href="./simpleList.tmph.html">
<div>
  <SimpleList :items="['a','b','c']" />
</div>
```

Example with an import `as` name specified:

```html
<link rel="import" href="./simpleList.tmph.html" as="ICanCallThisAnything">
<div>
  <ICanCallThisAnything :items="[1,2,3]">
</div>
```

It is recommended that you keep your imported component names in PascalCase for consistency,
but you can technically do whatever you want.
For instance, if you prefer to use dash-separated web component syntax instead, that's fine.
It is very much not recommended, but you could even import with a name to override native HTML elements.

```html
<link rel="import" href="./MyList.tmph.html" as="my-list">
<my-list :items="[1,2,3]" />

<!-- This is not advised, but technically allowed -->
<link rel="import" href="./List.tmph.html" as="ul">
<ul :items="[1,2,3]"></ul>
```

### Named imports

By default, import links will import the default root-level component from the imported template.
However, if there are any sub-components defined within a template file, those specific sub-components can be imported
by adding a hash to the import `href` matching that sub-component's `id`.

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

<!-- MyComponent.tmph.html -->
<link rel="import" href="./List.tmph.html#ListItem">
<ListItem :item="{ name: 'Hello!' }" />

<!-- AnotherComponent.tmph.html -->
<link rel="import" href="./List.tmph.html#ListItem" as="MyLI">
<MyLI :item="{ name: 'Hello!' }" />
```







