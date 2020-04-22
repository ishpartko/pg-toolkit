import { Client } from 'pg'
import { PgTools } from './pg-tools'
import { checkFileExists } from './fs'
import { logError, logInfo, logOK } from './logger'
import json5 = require('json5')
import fs = require('fs')
import path = require('path')
import merge = require('deepmerge')
import commander = require('commander')
import prompts = require('prompts');

interface DBconfig {
  host: string,
  port: number,
  user: string,
  password: string,
  database: string
}

async function disconnectAll (client: Client, dbName: string): Promise<void> {
  try {
    logInfo(`Отключаю остальных клиентов от "${dbName}"`)
    await client.query(/* sql */`SELECT 
      pg_terminate_backend(pid) 
    FROM 
      pg_stat_activity 
    WHERE 
      -- don't kill my own connection!
      pid <> pg_backend_pid()
      -- don't kill the connections to other databases
      AND datname = '${dbName}'
      ;`)
    logOK()
  } catch (err) {
    logError(err)
  }
}

async function dropDB (client: Client, dbName: string) {
  try {
    logInfo(`Удаляю БД "${dbName}"`)
    await client.query(/* sql */`DROP DATABASE ${dbName}`)

    logOK()
  } catch (err) {
    logError(err)
  }
}

async function createDB (client: Client, dbName: string) {
  try {
    logInfo(`Создаю БД "${dbName}"`)
    await client.query(/* sql */`CREATE DATABASE ${dbName}`)

    logOK()
  } catch (err) {
    logError(err)
  }
}

async function restoreDBFromFile (dbConfig: DBconfig, dbToRestoreName: string, pathToSqlFile: string) {
  try {
    logInfo(`Восстанавливаю данные в "${dbToRestoreName}" из "${pathToSqlFile}"`)
    const options = {
      ...dbConfig,
      database: dbToRestoreName
    }
    const tool = new PgTools(options)

    await tool.restoreDatabase(pathToSqlFile)

    logOK()
  } catch (err) {
    logError(err)
  }
}

async function restoreDB (dbConfig: DBconfig, dbNameToRestore: string, pathToSqlFile: string) {
  const client = new Client(dbConfig)
  process.env.PGPASSWORD = dbConfig.password

  try {
    await client.connect()
  } catch (err) {
    logError('Подключение не удалось')
    console.error(err)
  }
  await disconnectAll(client, dbNameToRestore)
  await dropDB(client, dbNameToRestore)
  await createDB(client, dbNameToRestore)
  await client.end()
  await restoreDBFromFile(dbConfig, dbNameToRestore, pathToSqlFile)
}

interface AppConfig {
  db: {
    host: string,
    port: string,
    user: string,
    password?: string,
    name?: string
  }
}

function getDefaultConfig ():AppConfig {
  return {
    db: {
      user: 'postgres',
      password: '',
      host: 'localhost',
      port: '5432'
    }
  }
}

function readConfigFile (): Promise<string> {
  return new Promise((resolve, reject) => {
    fs.readFile(path.resolve('pg-toolkit.config.json5'), (err, data: Buffer) => {
      if (err) {
        return reject(err)
      }
      return resolve(data.toString())
    })
  })
}

async function getConfig () {
  const defaultConfig = getDefaultConfig()
  const configFileData = await readConfigFile()
  const fileConfigObject = json5.parse(configFileData)
  return merge(defaultConfig, fileConfigObject)
}

async function main () {
  const config = await getConfig()

  commander.program.version(process.env.npm_package_version)
    .command('dnr [sqlFilePath]')
    .option('-d, --database <value>', 'name of db', config.db.name)
    .option('-h, --host <value>', 'host of db', config.db.host)
    .option('-t, --port <value>', 'db port', config.db.port)
    .option('-U, --user <value>', 'username of db', config.db.user)
    .option('-p, --request-password', 'db user password')
    .option('-l, --log', 'logging', false)
    .option('-y, --yes-all', 'yes to all', false)
    .action(async (pathToSqlFile: string, cmdObj: any) => {
      let dbPassword = config.db.password
      if (cmdObj.requestPassword) {
        const response = await prompts([
          {
            type: 'invisible',
            name: 'password',
            message: `Веедите пароль для пользователя ${cmdObj.user}:`,
            initial: false
          }
        ])
        dbPassword = response.password
      }
      if (!dbPassword) {
        logInfo('Password of db is empty!')
      }
      const isExists = await checkFileExists(pathToSqlFile)
      if (!isExists) {
        logError(`file "${pathToSqlFile}" is not exists`)
      }
      const connectionOptions = {
        host: cmdObj.host,
        port: parseInt(cmdObj.port, 10),
        database: 'postgres',
        user: cmdObj.user,
        password: dbPassword
      }
      const targetDbName = cmdObj.database

      logInfo(`Буду дропать и потом восстанавливать базу "${targetDbName}" из файла "${pathToSqlFile}"`)
      if (cmdObj.log) {
        logInfo('Параметры подключения:')
        console.log(connectionOptions)
      }

      if (cmdObj.yesAll) {
        restoreDB(connectionOptions, targetDbName, pathToSqlFile)
      } else {
        const response = await prompts([
          {
            type: 'confirm',
            name: 'isNeedBegin',
            message: 'Начинаем?',
            initial: false
          }
        ])
        if (response.isNeedBegin) {
          restoreDB(connectionOptions, targetDbName, pathToSqlFile)
        }
      }
    })

  commander.program.parse(process.argv)
}

main()
