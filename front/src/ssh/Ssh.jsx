import React, {useEffect} from 'react';
import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import {ws_connect, readFile} from "./help";
import styles from './ssh.module.css'
import 'xterm/css/xterm.css';


function Ssh() {
    const [searchParams, setSearchParams] = useSearchParams();
    const hostname = searchParams.get("host")
    const port = searchParams.get("port")
    const user = searchParams.get("user")
    const key = searchParams.get("key")
    const connect = searchParams.get("connect") === 'true'

    const [conf, setConf]   = useState(
        {
            isShowConnect: true,
            hostname: hostname ? hostname : "127.0.0.1",
            port: port ? port : 22,
            login: user ? user : "ture",
            type: "pwd",
            key: key ? key : "eturin",
            keyText: "",
            pwd: "",
            isShowUtils: false,
            utilsType: "logs",
            container: "",
            cnt: 250
        });

    useEffect(() => {
        if (connect === true) {
            ws_connect(conf, setConf)
        }
    }, [conf,connect]);


    // типы аутентификации
    const authTypes = [{key: "keysname", descr: "Имя ssh-ключа"},{key: "key", descr: "Файл ssh-ключа"},{key: "pwd", descr: "Пароль"}]
    const authJSX = authTypes.map((x,i) => (
        <span key={i}
              className={styles.auth_item}>
            <input type="radio"
                   name="auth"
                   key={x.key}
                   id={x.key}
                   value={x.key}
                   checked={conf.type === x.key}
                   onChange={() => setConf({...conf, type: x.key})}/>
            <label key={i}
                   htmlFor={x.key}>{x.descr}</label>
        </span>
        )
    )

    return (
        <>
            <div className={styles.container}>
                <div id="connect"
                     hidden={!conf.isShowConnect}
                     className={styles.connect}>
                    <div className={styles.user}/>
                    <form >
                        <h1 className={styles.hconnect}>СОЕДИНЕНИЕ</h1>
                        <div>
                            <span key="host">
                                <label htmlFor="host"
                                       className={styles.lhost} >Хост</label>
                                <input type="text"
                                       key="host"
                                       placeholder="host"
                                       value={conf?.hostname}
                                       onChange={(e) => setConf({...conf, hostname: e.currentTarget.value})}
                                       className={styles.fhost}/>
                            </span>

                            <span key="port">
                                <label htmlFor="port"
                                       className={styles.lport}>:</label>
                                <input type="number"
                                       key="port"
                                       placeholder={22}
                                       value={conf.port}
                                       onChange={(e) => setConf({...conf, port: parseInt(e.currentTarget.value) ? parseInt(e.currentTarget.value) : conf.port})}
                                       className={styles.fport} />
                            </span>
                        </div>

                        <div key="user">
                            <label htmlFor="user"
                                   className={styles.luser}>Пользователь</label>
                            <input type="text"
                                   key="user"
                                   placeholder="user"
                                   value={conf.login}
                                   onChange={(e) => setConf({...conf, login: e.currentTarget.value})}
                                   className={styles.fuser}/>
                        </div>

                        <div key="auth">
                            <label htmlFor="auth"
                                   className={styles.ltype}>Тип аутентификации</label>
                            <div key="auth">
                                { authJSX }
                            </div>

                            <div hidden={conf.type !== "keysname"}>
                                <label htmlFor="keyname">Имя ключа</label>
                                <input id="keyname"
                                       placeholder="Имя ключа"
                                       value={conf.key}
                                       onChange={(e) => setConf({...conf, key: e.currentTarget.value})}/>
                            </div>

                            <div hidden={conf.type !== "key"}>
                                <label htmlFor="pkey">Ключ</label>
                                <input type="file"
                                       id="pkey"
                                       onChange={() => readFile('pkey', conf, setConf)}/>
                            </div>

                            <div>
                                <label htmlFor="password">Пароль</label>
                                <input type="password"
                                       id="password"
                                       placeholder="password"
                                       value={conf.pwd}
                                       autoComplete="off"
                                       onChange={(e) => setConf({...conf,
                                                                                                         pwd: e.currentTarget.value})}/>
                            </div>

                            <p key="helpBlock"><i>Если типом аутентификации является аутентификация по ключу, поле ввода
                                    пароля представляет собой секретную ключевую фразу.</i></p>

                            <div key="utils">
                                <input type="checkbox"
                                       id="utils"
                                       checked={conf.isShowUtils}
                                       onChange={() => {setConf({...conf,
                                                                             isShowUtils: !conf.isShowUtils}); } }/>
                                <label htmlFor="utils">Дополнительно</label>
                                <div hidden={!conf.isShowUtils}>
                                    <label htmlFor="container">Имя контейнера docker</label>
                                    <input type="text"
                                           id="container"
                                           placeholder="container"
                                           value={conf.container}
                                           onChange={(e) => {setConf({...conf,
                                                                                                               container: e.currentTarget.value}); } }/>
                                    <div>
                                        <input type="radio"
                                               name="utils"
                                               key="logs"
                                               id="logs"
                                               value="logs"
                                               checked={conf.utilsType === "logs"}
                                               onChange={() => setConf({...conf,
                                                                                    utilsType: "logs"})}/>
                                        <label htmlFor="logs">Логи</label>
                                        <input type="radio"
                                               name="utils"
                                               key="stats"
                                               id="stats"
                                               value="stats"
                                               checked={conf.utilsType === "stats"}
                                               onChange={() => setConf({...conf,
                                                                                    utilsType: "stats"})}/>
                                        <label htmlFor="stats">Отобразить статистику</label>
                                    </div>
                                    <div key="cnt" hidden={conf.utilsType !== "logs"}>
                                        <label htmlFor="logsize">Количество последних строк лога контейнера</label>
                                        <input type="number"
                                               id="logsize"
                                               value={conf.cnt}
                                               onChange={(e) => setConf({...conf,
                                                                                                                  cnt: parseInt(e.currentTarget.value) ? e.currentTarget.value : conf.cnt})}/>
                                    </div>
                                </div>
                            </div>


                        </div>
                        <button type="button" onClick={() => ws_connect(conf, setConf)}>Установить соединение</button>
                    </form>
                </div>


                <div id="console"
                     hidden={conf.isShowConnect}
                     className={styles.console}/>

            </div>
        </>
    )
}

export default Ssh;