import fs = require('fs')

export async function checkFileExists (sqlFilePath: string) {
  return new Promise((resolve, reject) => {
    process.nextTick(() => {
      fs.access(sqlFilePath, fs.constants.F_OK, async (err: Error) => {
        if (err) {
          resolve(false)
        }
        resolve(true)
      })
    })
  })
}
