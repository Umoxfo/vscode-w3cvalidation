# VS Code W3C Validation extention

The extension to enable W3C validation support by the [Nu Html Checker](http://validator.github.io/validator/) library.

## Getting Started
This extention works using Java applications. You must have Java 8 or later on your local environment.
If you don't have them installed, download and install a latest Java Development Kit (latest Java 8 is the minimum requirement).

After installing (or installed) the JDK, you would need to configure your environment for Java execution.
**Please restart the VS Code** in order to load reliably the changed environment variables.

Then open your HTML document(s).

## Setting the JDK
The path to the JDK requires to be set in the environment.

### Set the `JAVA_HOME` environment variable:
#### For Windows:
1. Select **Control Panel** and then **System**.
1. Click **Advanced** and then **Environment Variables**.
1. Click **New** in the section **System Variables**
1. Enter the **Variable name** as `JAVA_HOME` and  the **Variable value** as the installation path for the Java (e.g. C:\Program Files\Java\jdk-13).
1. Click **OK**
1. Find the `PATH` environment variable in the **System Variables** section and select it, click **Edit**.
1. Append `;%JAVA_HOME%\bin` for the `PATH` variable
1. Click **OK** and also click **OK**

### Disclaimer
After launching the VC code, it will take some time for the results to be displayed if the HTML is invalid.
