CREATE TABLE `completions` (
	`draft` text PRIMARY KEY NOT NULL,
	`order_id` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `records` (
	`key` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`data` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `stock` (
	`key` text PRIMARY KEY NOT NULL,
	`item` text NOT NULL,
	`location` text NOT NULL,
	`available` integer NOT NULL,
	CONSTRAINT "stock_nonnegative" CHECK("stock"."available" >= 0)
);
