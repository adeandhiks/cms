-- ============================================================
-- Dummy data for lecturing table
-- Run this in the Supabase SQL Editor after creating the table
-- ============================================================

INSERT INTO public.lecturing (course_name, program, semester, year, description) VALUES

-- Sistem Informasi Program
('Introduction to Information Systems', 'Information Systems', 'Semester 1', 2024, 'Fundamental concepts of information systems, including system development lifecycle, database concepts, and enterprise systems.'),
('Database Management Systems', 'Information Systems', 'Semester 2', 2024, 'Design and implementation of relational databases using SQL, normalization, indexing, and query optimization techniques.'),
('Data Mining', 'Information Systems', 'Semester 5', 2024, 'Techniques for discovering patterns in large datasets including classification, clustering, association rules, and predictive modeling.'),
('Business Intelligence', 'Information Systems', 'Semester 6', 2024, 'Tools and techniques for transforming raw data into meaningful insights for strategic business decision-making.'),
('Enterprise Resource Planning', 'Information Systems', 'Semester 7', 2025, 'Study of integrated enterprise systems covering modules such as finance, HR, supply chain, and customer relationship management.'),

-- Data Science Program
('Statistics for Data Science', 'Data Science', 'Semester 1', 2024, 'Probability theory, descriptive and inferential statistics, hypothesis testing, and regression analysis for data-driven insights.'),
('Machine Learning', 'Data Science', 'Semester 4', 2024, 'Supervised and unsupervised learning algorithms including decision trees, SVM, neural networks, and ensemble methods.'),
('Deep Learning', 'Data Science', 'Semester 5', 2025, 'Advanced neural network architectures including CNNs, RNNs, transformers, and their applications in computer vision and NLP.'),
('Big Data Analytics', 'Data Science', 'Semester 6', 2025, 'Processing and analyzing large-scale datasets using distributed computing frameworks such as Hadoop and Spark.'),

-- Informatika Program
('Data Structures and Algorithms', 'Informatics', 'Semester 2', 2024, 'Fundamental data structures (arrays, linked lists, trees, graphs) and algorithm design techniques including sorting and searching.'),
('Object-Oriented Programming', 'Informatics', 'Semester 3', 2024, 'Principles of OOP including encapsulation, inheritance, polymorphism, and design patterns using Java/Python.'),
('Software Engineering', 'Informatics', 'Semester 4', 2025, 'Software development methodologies, requirements engineering, software architecture, testing, and project management.'),
('Artificial Intelligence', 'Informatics', 'Semester 5', 2025, 'Foundations of AI including search algorithms, knowledge representation, natural language processing, and expert systems.'),
('Cloud Computing', 'Informatics', 'Semester 7', 2025, 'Cloud service models (IaaS, PaaS, SaaS), virtualization, containerization, and deployment on AWS/GCP/Azure platforms.');
