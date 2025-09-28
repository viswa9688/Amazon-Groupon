-- Database Performance Optimization Script
-- Run this to add indexes for better query performance

-- Products table indexes
CREATE INDEX IF NOT EXISTS idx_products_seller_id ON products(seller_id);
CREATE INDEX IF NOT EXISTS idx_products_category_id ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_is_active ON products(is_active);
CREATE INDEX IF NOT EXISTS idx_products_created_at ON products(created_at);

-- Orders table indexes
CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at);
CREATE INDEX IF NOT EXISTS idx_orders_seller_id ON orders(seller_id);

-- Order items table indexes
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product_id ON order_items(product_id);

-- Users table indexes
CREATE INDEX IF NOT EXISTS idx_users_phone_number ON users(phone_number);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_is_seller ON users(is_seller);
CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at);

-- User groups table indexes
CREATE INDEX IF NOT EXISTS idx_user_groups_user_id ON user_groups(user_id);
CREATE INDEX IF NOT EXISTS idx_user_groups_is_public ON user_groups(is_public);
CREATE INDEX IF NOT EXISTS idx_user_groups_created_at ON user_groups(created_at);

-- User group items table indexes
CREATE INDEX IF NOT EXISTS idx_user_group_items_user_group_id ON user_group_items(user_group_id);
CREATE INDEX IF NOT EXISTS idx_user_group_items_product_id ON user_group_items(product_id);

-- User group participants table indexes
CREATE INDEX IF NOT EXISTS idx_user_group_participants_user_group_id ON user_group_participants(user_group_id);
CREATE INDEX IF NOT EXISTS idx_user_group_participants_user_id ON user_group_participants(user_id);

-- Categories table indexes
CREATE INDEX IF NOT EXISTS idx_categories_slug ON categories(slug);

-- Discount tiers table indexes
CREATE INDEX IF NOT EXISTS idx_discount_tiers_product_id ON discount_tiers(product_id);

-- Composite indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_products_seller_active ON products(seller_id, is_active);
CREATE INDEX IF NOT EXISTS idx_orders_user_status ON orders(user_id, status);
CREATE INDEX IF NOT EXISTS idx_orders_seller_status ON orders(seller_id, status);
CREATE INDEX IF NOT EXISTS idx_orders_created_status ON orders(created_at, status);

-- Analyze tables to update statistics
ANALYZE products;
ANALYZE orders;
ANALYZE order_items;
ANALYZE users;
ANALYZE user_groups;
ANALYZE user_group_items;
ANALYZE user_group_participants;
ANALYZE categories;
ANALYZE discount_tiers;
