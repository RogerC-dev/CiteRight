-- Database schema for CiteRight Taiwan Legal API
-- This file contains the table definitions needed for the application

CREATE DATABASE IF NOT EXISTS `D1397218_LawExtension` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE `D1397218_LawExtension`;

-- Law table to store basic law information
CREATE TABLE IF NOT EXISTS `Law` (
    `id` int(11) NOT NULL AUTO_INCREMENT,
    `law_name` varchar(500) NOT NULL,
    `law_level` varchar(100) DEFAULT NULL,
    `category` varchar(200) DEFAULT NULL,
    `enacted_date` date DEFAULT NULL,
    `amended_date` date DEFAULT NULL,
    `status` varchar(50) DEFAULT 'active',
    `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `unique_law_name` (`law_name`),
    KEY `idx_law_level` (`law_level`),
    KEY `idx_category` (`category`),
    KEY `idx_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- LawArticle table to store individual articles of laws
CREATE TABLE IF NOT EXISTS `LawArticle` (
    `id` int(11) NOT NULL AUTO_INCREMENT,
    `law_id` int(11) NOT NULL,
    `article_number` varchar(50) NOT NULL,
    `article_content` text NOT NULL,
    `section_title` varchar(500) DEFAULT NULL,
    `chapter_title` varchar(500) DEFAULT NULL,
    `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    KEY `fk_article_law` (`law_id`),
    KEY `idx_article_number` (`article_number`),
    CONSTRAINT `fk_article_law` FOREIGN KEY (`law_id`) REFERENCES `Law` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- LawCaption table to store law captions/headings
CREATE TABLE IF NOT EXISTS `LawCaption` (
    `id` int(11) NOT NULL AUTO_INCREMENT,
    `law_id` int(11) NOT NULL,
    `caption_type` varchar(100) NOT NULL, -- 'chapter', 'section', 'subsection', etc.
    `caption_number` varchar(50) DEFAULT NULL,
    `caption_title` varchar(500) NOT NULL,
    `parent_caption_id` int(11) DEFAULT NULL,
    `order_number` int(11) DEFAULT 0,
    `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    KEY `fk_caption_law` (`law_id`),
    KEY `fk_caption_parent` (`parent_caption_id`),
    KEY `idx_caption_type` (`caption_type`),
    KEY `idx_order_number` (`order_number`),
    CONSTRAINT `fk_caption_law` FOREIGN KEY (`law_id`) REFERENCES `Law` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_caption_parent` FOREIGN KEY (`parent_caption_id`) REFERENCES `LawCaption` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- JudicialCase table for storing case information
CREATE TABLE IF NOT EXISTS `JudicialCase` (
    `id` int(11) NOT NULL AUTO_INCREMENT,
    `case_number` varchar(200) NOT NULL,
    `case_type` varchar(100) NOT NULL,
    `court_name` varchar(200) NOT NULL,
    `case_year` int(11) NOT NULL,
    `case_category` varchar(100) DEFAULT NULL,
    `judgment_date` date DEFAULT NULL,
    `case_summary` text DEFAULT NULL,
    `full_text` longtext DEFAULT NULL,
    `keywords` text DEFAULT NULL,
    `status` varchar(50) DEFAULT 'active',
    `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `unique_case` (`case_number`, `court_name`, `case_year`),
    KEY `idx_case_type` (`case_type`),
    KEY `idx_court_name` (`court_name`),
    KEY `idx_case_year` (`case_year`),
    KEY `idx_judgment_date` (`judgment_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Insert some sample data for testing
INSERT IGNORE INTO `Law` (`law_name`, `law_level`, `category`) VALUES
('民法', '法律', '民事法'),
('刑法', '法律', '刑事法'),
('憲法', '憲法', '憲法'),
('行政程序法', '法律', '行政法');

INSERT IGNORE INTO `LawArticle` (`law_id`, `article_number`, `article_content`) VALUES
(1, '第1條', '民事，法律所未規定者，依習慣；無習慣者，依法理。'),
(2, '第1條', '行為之處罰，以行為時之法律有明文規定者為限。拘束人身自由之保安處分，亦同。'),
(3, '第1條', '中華民國基於三民主義，為民有民治民享之民主共和國。');

INSERT IGNORE INTO `LawCaption` (`law_id`, `caption_type`, `caption_title`) VALUES
(1, 'chapter', '第一編 總則'),
(2, 'chapter', '第一編 總則'),
(3, 'chapter', '第一章 總綱');
