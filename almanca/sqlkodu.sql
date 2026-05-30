-- 1. Kelime tablosu (A1, A2, B1)
CREATE TABLE IF NOT EXISTS public.vocabulary (
  id SERIAL PRIMARY KEY,
  german_word TEXT NOT NULL,
  turkish_meaning TEXT NOT NULL,
  example_sentence TEXT,
  example_translation TEXT,
  level TEXT NOT NULL CHECK (level IN ('A1', 'A2', 'B1')),
  part_of_speech TEXT, -- isim, fiil, sıfat vs.
  gender CHAR(1), -- d, e, s (der, die, das)
  created_at TIMESTAMP DEFAULT now()
);

-- 2. Alıştırma soruları tablosu (çoktan seçmeli, boşluk doldurma)
CREATE TABLE IF NOT EXISTS public.exercises (
  id SERIAL PRIMARY KEY,
  question_type TEXT NOT NULL, -- 'multiple_choice', 'fill_blank', 'matching'
  question_text TEXT NOT NULL,
  correct_answer TEXT NOT NULL,
  option_a TEXT,
  option_b TEXT,
  option_c TEXT,
  option_d TEXT,
  level TEXT NOT NULL,
  vocabulary_id INTEGER REFERENCES vocabulary(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT now()
);

-- 3. Kullanıcı ilerleme (isteğe bağlı, oturum bazlı veya auth ile)
CREATE TABLE IF NOT EXISTS public.user_progress (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  exercise_id INTEGER REFERENCES exercises(id) ON DELETE CASCADE,
  is_correct BOOLEAN,
  answered_at TIMESTAMP DEFAULT now(),
  UNIQUE(user_id, exercise_id)
);

-- RLS (Row Level Security) – herkes kelime ve egzersizleri görebilir, sadece kendi progressini görebilir
ALTER TABLE public.vocabulary ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Herkes kelimeleri görebilir" ON public.vocabulary FOR SELECT USING (true);

ALTER TABLE public.exercises ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Herkes egzersizleri görebilir" ON public.exercises FOR SELECT USING (true);

ALTER TABLE public.user_progress ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Kullanıcı kendi progressini görebilir" ON public.user_progress FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Kullanıcı kendi progressini ekleyebilir" ON public.user_progress FOR INSERT WITH CHECK (auth.uid() = user_id);