import { useState } from "react";

// A React component that uses state and props
// to dynamically update and display data.

// Child component: receives data through PROPS (read-only).
function ProductCard({ name, price, quantity, onIncrease, onDecrease, onRemove }) {
  return (
    <div className="product">
      <div className="info">
        <h3>{name}</h3>
        <p>Price: Rs. {price}</p>
      </div>
      <div className="controls">
        <button onClick={onDecrease} aria-label={`Decrease ${name}`}>-</button>
        <span className="qty">{quantity}</span>
        <button onClick={onIncrease} aria-label={`Increase ${name}`}>+</button>
      </div>
      <div className="subtotal">Rs. {price * quantity}</div>
      <button className="remove" onClick={onRemove}>Remove</button>
    </div>
  );
}

// Child component: shows a summary passed in via props.
function Summary({ totalItems, totalPrice }) {
  return (
    <div className="summary">
      <p>Total items: <strong>{totalItems}</strong></p>
      <p>Total price: <strong>Rs. {totalPrice}</strong></p>
    </div>
  );
}

export default function App() {
  // Parent component owns the STATE (can change over time).
  const [products, setProducts] = useState([
    { id: 1, name: "Notebook", price: 60, quantity: 1 },
    { id: 2, name: "Pen Pack", price: 40, quantity: 2 },
    { id: 3, name: "Backpack", price: 850, quantity: 1 },
  ]);
  const [newName, setNewName] = useState("");
  const [newPrice, setNewPrice] = useState("");

  const changeQty = (id, delta) => {
    setProducts((prev) =>
      prev.map((p) =>
        p.id === id ? { ...p, quantity: Math.max(0, p.quantity + delta) } : p
      )
    );
  };

  const removeProduct = (id) =>
    setProducts((prev) => prev.filter((p) => p.id !== id));

  const addProduct = (e) => {
    e.preventDefault();
    if (!newName.trim() || Number(newPrice) <= 0) return;
    setProducts((prev) => [
      ...prev,
      { id: Date.now(), name: newName.trim(), price: Number(newPrice), quantity: 1 },
    ]);
    setNewName("");
    setNewPrice("");
  };

  const totalItems = products.reduce((sum, p) => sum + p.quantity, 0);
  const totalPrice = products.reduce((sum, p) => sum + p.price * p.quantity, 0);

  return (
    <div className="container">
      <h1>Shopping Cart</h1>
      <p className="subtitle">State and props updating data live</p>

      <form className="add-form" onSubmit={addProduct}>
        <input
          type="text"
          placeholder="Product name"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
        />
        <input
          type="number"
          placeholder="Price"
          min="1"
          value={newPrice}
          onChange={(e) => setNewPrice(e.target.value)}
        />
        <button type="submit">Add</button>
      </form>

      {products.length === 0 && <p className="empty">Your cart is empty.</p>}

      {products.map((p) => (
        <ProductCard
          key={p.id}
          name={p.name}
          price={p.price}
          quantity={p.quantity}
          onIncrease={() => changeQty(p.id, 1)}
          onDecrease={() => changeQty(p.id, -1)}
          onRemove={() => removeProduct(p.id)}
        />
      ))}

      <Summary totalItems={totalItems} totalPrice={totalPrice} />
    </div>
  );
}


