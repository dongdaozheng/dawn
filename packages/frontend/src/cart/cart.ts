class Cart {
	constructor(private readonly cart?: Cart) {
		console.log('Cart constructor', this.cart)
	}
}

export default Cart