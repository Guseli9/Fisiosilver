-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.clinical_reports (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid,
  file_name text,
  resumen_ia text,
  hemoglobina numeric,
  albumina numeric,
  vitamina_d_25_oh numeric,
  glucosa numeric,
  creatinina numeric,
  pcr numeric,
  sodio numeric,
  tsh numeric,
  vitamina_b12 numeric,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT clinical_reports_pkey PRIMARY KEY (id),
  CONSTRAINT clinical_reports_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id)
);

CREATE TABLE public.daily_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid,
  peso_kg numeric,
  frec_cardiaca_lpm integer,
  tas_mmhg integer,
  tad_mmhg integer,
  sat_o2_pct numeric,
  glucosa_mgdl numeric,
  caidas_detectadas integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  pantorrilla_cm numeric,
  abdomen_cm numeric,
  CONSTRAINT daily_logs_pkey PRIMARY KEY (id),
  CONSTRAINT daily_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id)
);

CREATE TABLE public.nutrition_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid,
  foto_url text,
  comida_descripcion text,
  calorias_est numeric,
  proteinas_g numeric,
  carbohidratos_g numeric,
  grasas_g numeric,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT nutrition_logs_pkey PRIMARY KEY (id),
  CONSTRAINT nutrition_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id)
);

CREATE TABLE public.users (
  id uuid NOT NULL,
  email text,
  nombre_usuario text,
  talla_cm numeric NOT NULL DEFAULT 170,
  avatar_id integer DEFAULT 0,
  diary_preferences jsonb DEFAULT '["weight", "systolicBP", "diastolicBP", "pulse", "glucose"]'::jsonb,
  alerts_json jsonb DEFAULT '[]'::jsonb,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT users_pkey PRIMARY KEY (id),
  CONSTRAINT users_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id)
);

CREATE TABLE public.vigs_assessments (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid,
  ayuda_dinero boolean NOT NULL,
  ayuda_telefono boolean NOT NULL,
  ayuda_medicacion boolean NOT NULL,
  barthel_grado integer CHECK (barthel_grado >= 0 AND barthel_grado <= 3),
  perdida_peso_6m boolean NOT NULL,
  deterioro_cognitivo_grado integer CHECK (deterioro_cognitivo_grado >= 0 AND deterioro_cognitivo_grado <= 2),
  usa_antidepresivos boolean NOT NULL,
  usa_psicofarmacos boolean NOT NULL,
  vulnerabilidad_social boolean NOT NULL,
  presenta_delirium boolean NOT NULL,
  caidas_recuentes boolean NOT NULL,
  presenta_ulceras boolean NOT NULL,
  polifarmacia boolean NOT NULL,
  presenta_disfagia boolean NOT NULL,
  dolor_control_dificil boolean NOT NULL,
  disnea_basal boolean NOT NULL,
  enf_oncologica integer DEFAULT 0 CHECK (enf_oncologica >= 0 AND enf_oncologica <= 2),
  enf_respiratoria integer DEFAULT 0 CHECK (enf_respiratoria >= 0 AND enf_respiratoria <= 2),
  enf_cardiaca integer DEFAULT 0 CHECK (enf_cardiaca >= 0 AND enf_cardiaca <= 2),
  enf_neurodegenerativa integer DEFAULT 0 CHECK (enf_neurodegenerativa >= 0 AND enf_neurodegenerativa <= 2),
  enf_digestiva integer DEFAULT 0 CHECK (enf_digestiva >= 0 AND enf_digestiva <= 2),
  enf_renal_cronica integer DEFAULT 0 CHECK (enf_renal_cronica >= 0 AND enf_renal_cronica <= 2),
  puntos_totales numeric,
  indice_vig_resultado numeric,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT vigs_assessments_pkey PRIMARY KEY (id),
  CONSTRAINT vigs_assessments_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id)
);