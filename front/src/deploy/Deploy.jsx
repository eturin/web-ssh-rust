import React, {useEffect, useState} from 'react';
import styles from './deploy.module.css'

const Deploy = () => {
    return (
        <div className={styles.deploy}>
            <form>
                <label htmlFor="stand">Стенд</label>
                <input type="text" id="stand" />
                <label htmlFor="system">Система</label>
                <input type="text" id="system" />
                <label htmlFor="version">Версия</label>
                <input type="text" id="version" />

                <button type="button">Выпустить релиз</button>
            </form>
        </div>
    )
}

export default Deploy