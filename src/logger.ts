import colors = require('colors/safe')

export const logOK = () => {
  console.log('✅ > ', colors.green('Успешно.'))
}

export const logInfo = (text: string) => {
  console.log('♿ > ', colors.blue(text))
}

export const logError = (text: string) => {
  console.log('😈 > ', colors.red(text))
  throw new Error('Рестор не выполнен. Проверьте параметры.')
}
