-- borsa_klines tablosu
-- Hisselerin gecmis 200 gunluk OHLCV verilerini JSONB formatinda tutar.

CREATE TABLE public.borsa_klines (
  symbol text PRIMARY KEY,
  klines jsonb NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- RLS (Row Level Security) ayarlari (Herkes okuyabilir, sadece yetkili yazabilir)
ALTER TABLE public.borsa_klines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Herkes borsa_klines verilerini okuyabilir"
  ON public.borsa_klines
  FOR SELECT
  USING (true);

-- API erisimi icin yetkili (service_role) yazabilir
-- service_role zaten full yetkiye sahiptir, ekstra policy gerekmeyebilir ama acikca belirtilebilir.
