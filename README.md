# BehaviorAI

Make sure to 
This project was bootstrapped with [Create React App](https://github.com/facebook/create-react-app).

## Setup

aws cli set up: 

windows

https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html

mac

`brew install awscli`

this is the aws cli that allows you to run aws cmds

`aws configure set region us-east-2`

`aws login`

on project directory folder

`npm install` 

Make sure to create a venv in the backend folder:

macOS/Linux

`python3.12 -m venv venv`

Windows

`py -3.12 -m venv venv`

and 

`pip install -r requirements.txt`

## Available Scripts

In the project directory, you can run:

### `npm run dev`
This is suppose to set up the backend and the frontend all together and runs both frontend and backend

later on will add another script that runs both backend and frontend tests

In the backend directory, you can run:

### `uvicorn main:app --reload`
Runs the fastAPI server

In the frontend directory, you can run:

### `npm start`

Runs the app in the development mode.\
Open [http://localhost:3000](http://localhost:3000) to view it in the browser.

The page will reload if you make edits.\
You will also see any lint errors in the console.

### `npm test`

Launches the test runner in the interactive watch mode.\
See the section about [running tests](https://facebook.github.io/create-react-app/docs/running-tests) for more information.

### `npm run build`

Builds the app for production to the `build` folder.\
It correctly bundles React in production mode and optimizes the build for the best performance.

The build is minified and the filenames include the hashes.\
Your app is ready to be deployed!

See the section about [deployment](https://facebook.github.io/create-react-app/docs/deployment) for more information.

### `npm run eject`

**Note: this is a one-way operation. Once you `eject`, you can’t go back!**

If you aren’t satisfied with the build tool and configuration choices, you can `eject` at any time. This command will remove the single build dependency from your project.

Instead, it will copy all the configuration files and the transitive dependencies (webpack, Babel, ESLint, etc) right into your project so you have full control over them. All of the commands except `eject` will still work, but they will point to the copied scripts so you can tweak them. At this point you’re on your own.

You don’t have to ever use `eject`. The curated feature set is suitable for small and middle deployments, and you shouldn’t feel obligated to use this feature. However we understand that this tool wouldn’t be useful if you couldn’t customize it when you are ready for it.
