"use client";

import styles from "./thesis.module.css";

export function PrintButton() {
  return (
    <button className={styles.printButton} type="button" onClick={() => window.print()}>
      PDF болгох
    </button>
  );
}
