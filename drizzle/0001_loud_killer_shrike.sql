CREATE TABLE `action_steps` (
	`id` int AUTO_INCREMENT NOT NULL,
	`workstationId` int NOT NULL,
	`stepName` varchar(255) NOT NULL,
	`stepOrder` int NOT NULL DEFAULT 0,
	`duration` decimal(10,2) NOT NULL,
	`actionType` enum('value_added','non_value_added','necessary_waste') NOT NULL DEFAULT 'value_added',
	`description` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `action_steps_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `production_lines` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`description` text,
	`targetCycleTime` decimal(10,2),
	`status` enum('active','inactive','archived') NOT NULL DEFAULT 'active',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `production_lines_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `workstations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`productionLineId` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`sequenceOrder` int NOT NULL DEFAULT 0,
	`cycleTime` decimal(10,2) NOT NULL,
	`manpower` int NOT NULL DEFAULT 1,
	`description` text,
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `workstations_id` PRIMARY KEY(`id`)
);
