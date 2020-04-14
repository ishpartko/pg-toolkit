import { Client } from 'pg'
import { PgTools, ConnectionOptions } from './pg-tools'
const colors = require('colors/safe')
const { program } = require('commander')

const logOK = () => {
  console.log('✅ > ', colors.green('Успешно.'))
}

const logInfo = (text: string) => {
  console.log('♿ > ', colors.blue(text))
}

const logError = (text: string) => {
  console.log('😈 > ', colors.red(text))
  throw new Error('Рестор не выполнен. Проверьте параметры.')
}

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
    const options: ConnectionOptions = {
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

program.version(process.env.npm_package_version)
  .command('r <sqlFilePath> [nameDbToRestore]')
  .option('-h, --host <value>', 'host of db', 'localhost')
  .option('-U, --user <value>', 'username', 'postgres')
  .requiredOption('-p, --password <value>', 'db user password', 'postgres')
  .option('-t, --port <value>', 'db port', 5432)
  .action((pathToSqlFile: string, nameDbToRestore: string, cmdObj: any) => {
    const connectionOptions: ConnectionOptions = {
      host: cmdObj.host,
      port: cmdObj.port,
      database: 'postgres',
      user: cmdObj.user,
      password: cmdObj.password
    }
    restoreDB(connectionOptions, nameDbToRestore, pathToSqlFile)
  })

program.parse(process.argv)
