-- KFT Parameters
INSERT INTO test_parameters 
(test_id, param_name, unit, range_male_min, range_male_max, range_female_min, range_female_max, range_text, display_order)
SELECT tc.id, p.param_name, p.unit, p.rmin, p.rmax, p.fmin, p.fmax, p.range_text, p.ord
FROM test_catalogue tc
CROSS JOIN (VALUES
  ('Serum Creatinine','mg/dL',0.7,1.2,0.5,1.0,'0.7-1.2 (M), 0.5-1.0 (F)',1),
  ('Blood Urea Nitrogen','mg/dL',7,20,7,20,'7-20',2),
  ('Blood Urea','mg/dL',15,45,15,45,'15-45',3),
  ('Serum Uric Acid','mg/dL',3.5,7.2,2.6,6.0,'3.5-7.2 (M), 2.6-6.0 (F)',4),
  ('Serum Sodium','mEq/L',136,145,136,145,'136-145',5),
  ('Serum Potassium','mEq/L',3.5,5.1,3.5,5.1,'3.5-5.1',6),
  ('Serum Chloride','mEq/L',98,107,98,107,'98-107',7),
  ('Serum Bicarbonate','mEq/L',22,29,22,29,'22-29',8),
  ('eGFR','mL/min/1.73m2',60,999,60,999,'>60 Normal',9),
  ('Serum Calcium','mg/dL',8.5,10.5,8.5,10.5,'8.5-10.5',10),
  ('Serum Phosphorus','mg/dL',2.5,4.5,2.5,4.5,'2.5-4.5',11)
) AS p(param_name,unit,rmin,rmax,fmin,fmax,range_text,ord)
WHERE tc.code='KFT';

-- CBC Parameters
INSERT INTO test_parameters
(test_id, param_name, unit, range_male_min, range_male_max, range_female_min, range_female_max, range_text, display_order)
SELECT tc.id, p.param_name, p.unit, p.rmin, p.rmax, p.fmin, p.fmax, p.range_text, p.ord
FROM test_catalogue tc
CROSS JOIN (VALUES
  ('Haemoglobin','g/dL',13.5,17.5,11.5,15.5,'13.5-17.5 (M), 11.5-15.5 (F)',1),
  ('RBC Count','mill/cumm',4.5,5.5,3.8,4.8,'4.5-5.5 (M), 3.8-4.8 (F)',2),
  ('WBC Count','cells/cumm',4000,11000,4000,11000,'4000-11000',3),
  ('Platelet Count','lakhs/cumm',1.5,4.5,1.5,4.5,'1.5-4.5',4),
  ('Haematocrit (PCV)','%',40,52,36,48,'40-52 (M), 36-48 (F)',5),
  ('MCV','fL',80,100,80,100,'80-100',6),
  ('MCH','pg',27,33,27,33,'27-33',7),
  ('MCHC','g/dL',31.5,34.5,31.5,34.5,'31.5-34.5',8),
  ('Neutrophils','%',40,70,40,70,'40-70',9),
  ('Lymphocytes','%',20,45,20,45,'20-45',10),
  ('Monocytes','%',2,10,2,10,'2-10',11),
  ('Eosinophils','%',1,6,1,6,'1-6',12),
  ('Basophils','%',0,1,0,1,'0-1',13),
  ('ESR','mm/hr',0,15,0,20,'0-15 (M), 0-20 (F)',14)
) AS p(param_name,unit,rmin,rmax,fmin,fmax,range_text,ord)
WHERE tc.code='CBC';

-- LFT Parameters
INSERT INTO test_parameters
(test_id, param_name, unit, range_male_min, range_male_max, range_female_min, range_female_max, range_text, display_order)
SELECT tc.id, p.param_name, p.unit, p.rmin, p.rmax, p.fmin, p.fmax, p.range_text, p.ord
FROM test_catalogue tc
CROSS JOIN (VALUES
  ('Total Bilirubin','mg/dL',0.2,1.2,0.2,1.2,'0.2-1.2',1),
  ('Direct Bilirubin','mg/dL',0,0.3,0,0.3,'0-0.3',2),
  ('Indirect Bilirubin','mg/dL',0.1,1.0,0.1,1.0,'0.1-1.0',3),
  ('SGOT (AST)','U/L',10,40,10,40,'10-40',4),
  ('SGPT (ALT)','U/L',7,56,7,56,'7-56',5),
  ('Alkaline Phosphatase','U/L',44,147,44,147,'44-147',6),
  ('Total Protein','g/dL',6.0,8.3,6.0,8.3,'6.0-8.3',7),
  ('Albumin','g/dL',3.5,5.0,3.5,5.0,'3.5-5.0',8),
  ('Globulin','g/dL',2.0,3.5,2.0,3.5,'2.0-3.5',9),
  ('A/G Ratio','ratio',1.2,2.2,1.2,2.2,'1.2-2.2',10),
  ('GGT','U/L',8,61,5,36,'8-61 (M), 5-36 (F)',11)
) AS p(param_name,unit,rmin,rmax,fmin,fmax,range_text,ord)
WHERE tc.code='LFT';

-- Lipid Profile Parameters
INSERT INTO test_parameters
(test_id, param_name, unit, range_male_min, range_male_max, range_female_min, range_female_max, range_text, display_order)
SELECT tc.id, p.param_name, p.unit, p.rmin, p.rmax, p.fmin, p.fmax, p.range_text, p.ord
FROM test_catalogue tc
CROSS JOIN (VALUES
  ('Total Cholesterol','mg/dL',0,200,0,200,'<200 Desirable',1),
  ('HDL Cholesterol','mg/dL',40,60,50,60,'40-60 (M), 50-60 (F)',2),
  ('LDL Cholesterol','mg/dL',0,100,0,100,'<100 Optimal',3),
  ('VLDL Cholesterol','mg/dL',2,30,2,30,'2-30',4),
  ('Triglycerides','mg/dL',0,150,0,150,'<150 Normal',5),
  ('TC/HDL Ratio','ratio',0,5,0,4.5,'<5 (M), <4.5 (F)',6)
) AS p(param_name,unit,rmin,rmax,fmin,fmax,range_text,ord)
WHERE tc.code='LIPID';

-- Thyroid Profile Parameters
INSERT INTO test_parameters
(test_id, param_name, unit, range_male_min, range_male_max, range_female_min, range_female_max, range_text, display_order)
SELECT tc.id, p.param_name, p.unit, p.rmin, p.rmax, p.fmin, p.fmax, p.range_text, p.ord
FROM test_catalogue tc
CROSS JOIN (VALUES
  ('T3 (Triiodothyronine)','ng/dL',80,200,80,200,'80-200',1),
  ('T4 (Thyroxine)','ug/dL',5.1,14.1,5.1,14.1,'5.1-14.1',2),
  ('TSH','uIU/mL',0.4,4.0,0.4,4.0,'0.4-4.0',3)
) AS p(param_name,unit,rmin,rmax,fmin,fmax,range_text,ord)
WHERE tc.code='TSH';

-- HbA1c Parameters
INSERT INTO test_parameters
(test_id, param_name, unit, range_male_min, range_male_max, range_female_min, range_female_max, range_text, display_order)
SELECT tc.id, p.param_name, p.unit, p.rmin, p.rmax, p.fmin, p.fmax, p.range_text, p.ord
FROM test_catalogue tc
CROSS JOIN (VALUES
  ('HbA1c','%',0,5.7,0,5.7,'<5.7 Normal, 5.7-6.4 Pre-diabetes, >6.4 Diabetes',1),
  ('Estimated Avg Glucose','mg/dL',0,117,0,117,'<117 Normal',2)
) AS p(param_name,unit,rmin,rmax,fmin,fmax,range_text,ord)
WHERE tc.code='HBA1C';

-- Urine Routine Parameters
INSERT INTO test_parameters
(test_id, param_name, unit, range_male_min, range_male_max, range_female_min, range_female_max, range_text, display_order)
SELECT tc.id, p.param_name, p.unit, p.rmin, p.rmax, p.fmin, p.fmax, p.range_text, p.ord
FROM test_catalogue tc
CROSS JOIN (VALUES
  ('Colour','','','','','','Yellow',1),
  ('Appearance','','','','','','Clear',2),
  ('pH',NULL,4.5,8.5,4.5,8.5,'4.5-8.5',3),
  ('Specific Gravity',NULL,1.001,1.035,1.001,1.035,'1.001-1.035',4),
  ('Protein','mg/dL',0,20,0,20,'<20 Negative',5),
  ('Glucose','mg/dL',0,15,0,15,'<15 Negative',6),
  ('RBC','cells/hpf',0,2,0,2,'0-2',7),
  ('WBC/Pus Cells','cells/hpf',0,5,0,5,'0-5',8),
  ('Epithelial Cells','cells/hpf',0,5,0,5,'0-5',9),
  ('Casts',NULL,0,0,0,0,'Nil',10),
  ('Crystals',NULL,0,0,0,0,'Nil',11)
) AS p(param_name,unit,rmin,rmax,fmin,fmax,range_text,ord)
WHERE tc.code='URINE';

-- CRP Parameters
INSERT INTO test_parameters
(test_id, param_name, unit, range_male_min, range_male_max, range_female_min, range_female_max, range_text, display_order)
SELECT tc.id, p.param_name, p.unit, p.rmin, p.rmax, p.fmin, p.fmax, p.range_text, p.ord
FROM test_catalogue tc
CROSS JOIN (VALUES
  ('CRP (Quantitative)','mg/L',0,5,0,5,'<5 Normal, 5-10 Mild, >10 Significant',1)
) AS p(param_name,unit,rmin,rmax,fmin,fmax,range_text,ord)
WHERE tc.code='CRP';

-- Vitamin D & B12 Parameters
INSERT INTO test_parameters
(test_id, param_name, unit, range_male_min, range_male_max, range_female_min, range_female_max, range_text, display_order)
SELECT tc.id, p.param_name, p.unit, p.rmin, p.rmax, p.fmin, p.fmax, p.range_text, p.ord
FROM test_catalogue tc
CROSS JOIN (VALUES
  ('Vitamin D (25-OH)','ng/mL',30,100,30,100,'<20 Deficient, 20-30 Insufficient, >30 Normal',1),
  ('Vitamin B12','pg/mL',200,900,200,900,'200-900',2)
) AS p(param_name,unit,rmin,rmax,fmin,fmax,range_text,ord)
WHERE tc.code='VIT';

-- Dengue Parameters
INSERT INTO test_parameters
(test_id, param_name, unit, range_male_min, range_male_max, range_female_min, range_female_max, range_text, display_order)
SELECT tc.id, p.param_name, p.unit, p.rmin, p.rmax, p.fmin, p.fmax, p.range_text, p.ord
FROM test_catalogue tc
CROSS JOIN (VALUES
  ('Dengue NS1 Antigen',NULL,0,0,0,0,'Negative',1),
  ('Dengue IgM Antibody',NULL,0,0,0,0,'Negative',2),
  ('Dengue IgG Antibody',NULL,0,0,0,0,'Negative',3)
) AS p(param_name,unit,rmin,rmax,fmin,fmax,range_text,ord)
WHERE tc.code='DENG';

-- COVID RT-PCR Parameters
INSERT INTO test_parameters
(test_id, param_name, unit, range_male_min, range_male_max, range_female_min, range_female_max, range_text, display_order)
SELECT tc.id, p.param_name, p.unit, p.rmin, p.rmax, p.fmin, p.fmax, p.range_text, p.ord
FROM test_catalogue tc
CROSS JOIN (VALUES
  ('SARS-CoV-2 RT-PCR Result',NULL,0,0,0,0,'Negative',1),
  ('Ct Value (E Gene)',NULL,0,0,0,0,'>35 Negative',2),
  ('Ct Value (RdRp Gene)',NULL,0,0,0,0,'>35 Negative',3)
) AS p(param_name,unit,rmin,rmax,fmin,fmax,range_text,ord)
WHERE tc.code='COVID';