import React from 'react'
import Ssh from './ssh/Ssh'
import styles from './App.module.css'
import {Route, BrowserRouter, Routes} from "react-router-dom";
import Deploy from "./deploy/Deploy";
function App() {
    return (
        <BrowserRouter>
            <Routes>
                <Route path="/" element={<Ssh />} />
                {/*<Route path="/deploy" element={<Deploy />} />*/}
            </Routes>
        </BrowserRouter>
    )
}

export default App;