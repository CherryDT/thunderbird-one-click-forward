# One Click Forward

Thunderbird add-on to forward emails directly through a dropdown of predefined forwarding configurations.

By David Trapp

Set up forwarding configurations in settings, each with recipients, from identity, forward type, and a post-forward action (do nothing, archive, trash, or delete permanently). Then, use the message toolbar button "Quick Forward" to open a dropdown with your configurations and forward the email with one click. Alt+Click the toolbar button to auto-forward using the first configuration.

You can also use "Quick Forward" from Thunderbird's unified toolbar in the Mail space. If the button is missing, right-click the unified toolbar, choose **Customize**, and add **One-Click Forward** to the Mail toolbar. Select exactly one email in the message list, then click the button to choose a forwarding configuration. This works even when the message preview pane is hidden. On older Thunderbird versions, the button is available in the main toolbar.

If you hold Shift while clicking a configuration, the compose window will stay open without actually sending the email, so you can add further changes before sending it. However, if you do that, the after-forwarding action will not be executed, so you will have to archive/trash/delete the original email manually if you want to.

## Features

- Multiple forwarding configurations
- Forward from the message toolbar or unified toolbar, including with the preview pane hidden
- Custom from identity per configuration
- Forward as inline or attachment
- Action after forwarding: do nothing / archive / trash / delete permanently
- Alt+Click for quick auto-forward with first config
