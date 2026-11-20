
import React from 'react';

export default function App() {
  return (
    <div className="app">
      <header className="header">
        <h1>GSMPLUS</h1>
        <p>Firmware Download & Mobile Service</p>
      </header>

      <main className="container">
        <h2>Welcome to GSMPLUS</h2>
        <p>
          Your trusted platform for mobile firmware,
          software and servicing solutions.
        </p>

        <section className="services">
          <h2>Our Services</h2>
          <div className="service">
            <h3>Free Firmware</h3>
            <p>Download available free firmware.</p>
          </div>
          <div className="service">
            <h3>Premium Firmware</h3>
            <p>Access premium firmware and services.</p>
          </div>
          <div className="service">
            <h3>Mobile Servicing</h3>
            <p>Find software and servicing resources.</p>
          </div>
        </section>
      </main>

      <footer>
        © 2026 GSMPLUS. All rights reserved.
      </footer>
    </div>
  );
}
