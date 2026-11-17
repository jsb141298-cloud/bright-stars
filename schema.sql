CREATE TABLE IF NOT EXISTS enquiries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  name TEXT, phone TEXT, postcode TEXT, contact_method TEXT,
  answers TEXT, recommendation TEXT, total_price REAL,
  status TEXT DEFAULT 'new'
);
