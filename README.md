# DecentAppsNet/deploy Github Action

This Github action is designed for deploying apps on the [Decent Portal](https://decentapps.net). You're welcome to use this action however you like, but most people won't find it useful unless:

* You're building a Decent app using the [create-decent-app code generator](https://github.com/erikh2000/create-decent-app).
* You want that app to deploy to the [Decent Portal](https://decentapps.net).
* Your app has been approved for portal hosting and you've received the necessary deployment secrets/credentials.

If all of the above apply and you're just looking to get things working, the [create-decent-app documentation](https://github.com/erikh2000/create-decent-app) has all the setup instructions you need.

# Support for this Repository

Yes, this is open source, but this repo functions more like a dependency than a standalone project. It’s not tracked or maintained in the usual open source fashion. Please use the [create-decent-app repository](https://github.com/erikh2000/create-decent-app) for issues, documentation, and support.

# Security Concerns

I always welcome feedback. But on security, I double-welcome it! Please feel free to [open an issue](https://github.com/erikh2000/create-decent-app/issues) or contact me if you have any suggestions.

# Development and Deployment

These are more notes for myself to keep track of how I set up the project.

* No dependencies other than those built in to Node.
* There is a pre-commit hook that runs esbuild to create a bundled .js. That bundled JS file is the entrypoint for the action. The bundling is needed for easy execution in the Github CI environment.
* If you clone the repo to a new working directory, you'll need to copy /local-setup/pre-commit to .git/hooks/pre-commit for it to work.
* Debugging directly against the typescript files (rather than the bundled JS) can be accomplished with node v23 or later.
* The debugger will need some environment variables set up. See comments in index.ts for each one.
* Breakpoints work a little unreliably with the experimental type stripping in Node v24. Add `debugger` JS statement if needed.

# Licensing

This repository is licensed under the MIT License.

# Contacting

You can reach me via my LinkedIn profile. I'll accept connections if you will just mention "decent apps" or some other shared interest in your connection request.

-Erik Hermansen