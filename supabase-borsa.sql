CREATE TABLE IF NOT EXISTS borsa_data (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  symbol TEXT NOT NULL UNIQUE,
  name TEXT,
  price TEXT,
  change_percentage TEXT,
  time TEXT,
  detail_link TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE borsa_data ENABLE ROW LEVEL SECURITY;

-- Create policy to allow all users to select
CREATE POLICY "Allow public read access on borsa_data" 
  ON borsa_data FOR SELECT 
  USING (true);

-- Create policy to allow all users to insert/update (for the scraper, ideally authenticated but we'll allow anon for now depending on setup)
CREATE POLICY "Allow public insert on borsa_data" 
  ON borsa_data FOR INSERT 
  WITH CHECK (true);

CREATE POLICY "Allow public update on borsa_data" 
  ON borsa_data FOR UPDATE 
  USING (true);
