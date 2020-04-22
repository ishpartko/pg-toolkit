'use strict'
import { exec } from 'child_process'
import { checkFileExists } from './fs'

export interface ConnectionOptions {
  host: string,
  port: number,
  user: string,
  password: string,
  database: string
}

export type Callback = (error: Error, output: string, message: string) => void

export interface IPgTools {
  connectionOptions: ConnectionOptions
  // dumpDatabase(dumpPath: string): void
  restoreDatabase(sqlFilePath: string): void
}

export class PgTools implements IPgTools {
  public connectionOptions: ConnectionOptions

  constructor (connectionOptions: ConnectionOptions) {
    this.connectionOptions = connectionOptions
  }
  /*
     * create dump sql file of database
     * @param {Object} options, {host: 'localhost', port: 5432, user: 'postgres', password: 'postgres", dumpPath: '/home/backup',database: 'test'}
     * @param {Function} callback
     * @returns {undefined}
     */
  // dumpDatabase (options, callback) {
  //   process.nextTick(function () {
  //     let error,
  //       command,
  //       time,
  //       filePath,
  //       extName,
  //       dirName,
  //       ls
  //     if (!options.host || !options.user || !options.port || !options.dumpPath || !options.database) {
  //       error = new Error('Invalid options')
  //       error.name = 'InvalidOptions'
  //       callback(error, null)
  //     } else {
  //       extName = path.extname(options.dumpPath)
  //       dirName = path.dirname(options.dumpPath)
  //       if (extName && extName.toLowerCase() !== '.sql') {
  //         error = new Error('Invalid file type')
  //         error.name = 'InvalidFileExtension'
  //         callback(error, null)
  //         return false
  //       }

  //       fs.exists((extName === '') ? options.dumpPath : dirName, function (exists) {
  //         if (!exists) {
  //           error = new Error('Dump path doesn\'t exists')
  //           error.name = 'InvalidPath'
  //           callback(error, null)
  //         } else {
  //           if (extName && extName.toLowerCase() === '.sql') {
  //             filePath = options.dumpPath
  //           } else {
  //             time = new Date().getTime()
  //             filePath = path.join(options.dumpPath, options.database + time + '.sql')
  //           }
  //           if (options.password) {
  //             command = util.format('pg_dump -i -h %s -p %d -W -U %s -F c -b -v -f %s %s', options.host, options.port, options.user, filePath, options.database)
  //           } else {
  //             command = util.format('pg_dump -i -h %s -p %d --no-password -U %s -F c -b -v -f %s %s', options.host, options.port, options.user, filePath, options.database)
  //           }
  //           ls = exec(command, function (error, stdout, stderr) {
  //             if (error !== null) {
  //               callback(error, null, null)
  //               return false
  //             }
  //             callback(null, (stdout || stderr), util.format('Pgdump %s file created successfully', filePath), filePath)
  //           })
  //           ls.stdin.write(options.password + '\n')
  //           ls.stdin.end()
  //         }
  //       })
  //     }
  //   })
  // }

  private async execCommand (command: string) {
    return new Promise((resolve, reject) => {
      const ls = exec(command, (err: Error, stdout, stderr) => {
        if (err) {
          reject(err)
        }
        resolve(stdout || stderr)
      })
      this.connectionOptions.password.split('').forEach((char) => {
        ls.stdin.write(char)
      })
      ls.stdin.write('\n')
      // ls.stdin.end()
    })
  }

  public async restoreDatabase (sqlFilePath: string) {
    if (!this.connectionOptions.user || !this.connectionOptions.host || !this.connectionOptions.port || !this.connectionOptions.database) {
      throw new Error('Invalid Options')
    } else if (!sqlFilePath) {
      throw new Error('sql file path was not provided')
    }
    const isExists = await checkFileExists(sqlFilePath)
    if (isExists) {
      try {
        const { host, port, user, database, password } = this.connectionOptions
        const command = `psql -h ${host} -p ${port} -U ${user} -f ${sqlFilePath} -d ${database} ${!password ? '--no-password' : ''}`
        return await this.execCommand(command)
      } catch (err) {
        throw new Error(err)
      }
    }
  }
}
