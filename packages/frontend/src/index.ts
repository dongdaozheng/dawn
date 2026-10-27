import Cart from './cart/cart.js'

export { Cart }

export interface ThemeConfig {
  rootSelector: string
}

export function createThemeConfig(rootSelector: string): ThemeConfig {
  if (rootSelector.length === 0) {
    throw new Error('rootSelector is required')
  }

  return { rootSelector }
}

export const themeConfig: ThemeConfig = createThemeConfig('#MainContent')

const cart = new Cart()
console.log(cart)
