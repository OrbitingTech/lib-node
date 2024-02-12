# Defining a Layout

After you have defined your config you are going to want to be able to change it on the panel. In order to do this, it's **recommended you provide a layout** to the library. Doing this gives you the most control over how the config is going to show up on your panel.

## Layout Structure

The layout is provided in groups, formed by an array. Each group can have the following:

-   **A `title`** that will appear on the panel page above the controls
-   **A `description`** that will appear just below the title on the panel page
-   **A `permission`** that allows people to restrict who can control what groupings of controls
-   **An array of `controls`** where the magic happens

```jsonc
[
    {
        "title": "Standard Features",
        "description": "This is a set toggle controls for basic features of our app.",
        "controls": [
            /* ... */
        ],
    },
]
```

## Defining Controls

Controls are defined by a structure that refers back to the schema provided. Let's say we have provided the following schema for this particular app:

```jsonc
{
    "type": "object",
    "properties": {
        "allowFileUploads": {
            "type": "boolean",
            "default": true,
        },
    },
}
```

If we wanted to place our `allowFileUploads` control in the group we defined above we could define the control as such:

```jsonc
{ "for": "allowFileUploads" }
```

And by inserting this in the layout group's controls we would see that reflected on the panel for this app.

You're probably wondering though, _"why is this an object?"_ And that's a valid question. It's an object because there is a little more to it than I would lead you to believe. That's not to say the above example wouldn't work, it absolutely will.

The type is automatically inferred by referencing back to the schema provided. So Orbiting figures out that we are meant to show a `boolean` component to control `allowFileUploads`. However, there is **certainly more than one way to represent different values**.

```jsonc
{
    "for": "allowFileUploads",
    "renderAs": "checkbox",
}
```

We just changed the default rendering style! Now on the panel you will see a checkbox opposed to a switch.

### Different Render Types

todo: table of the different component render types for each schema type

### Labels

Controls can have labels defined for them.
