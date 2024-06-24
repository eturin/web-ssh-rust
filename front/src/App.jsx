import React from 'react'
import Ssh from './ssh/Ssh'
import styles from './App.module.css'
import {Route, BrowserRouter} from "react-router-dom";
function App() {
    return (
        <BrowserRouter>
            <Ssh path='/'  />
        </BrowserRouter>
    )
}

export default App;