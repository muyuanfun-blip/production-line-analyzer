CREATE TABLE "pla_action_steps" (
	"id" serial PRIMARY KEY NOT NULL,
	"workstationId" integer NOT NULL,
	"stepName" varchar(255) NOT NULL,
	"stepOrder" integer DEFAULT 0 NOT NULL,
	"duration" numeric(10, 2) NOT NULL,
	"actionType" varchar(30) DEFAULT 'value_added' NOT NULL,
	"description" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pla_analysis_snapshots" (
	"id" serial PRIMARY KEY NOT NULL,
	"productionLineId" integer NOT NULL,
	"name" varchar(255) NOT NULL,
	"note" text,
	"balanceRate" numeric(6, 2) NOT NULL,
	"balanceLoss" numeric(6, 2) NOT NULL,
	"totalTime" numeric(10, 2) NOT NULL,
	"maxTime" numeric(10, 2) NOT NULL,
	"minTime" numeric(10, 2) NOT NULL,
	"avgTime" numeric(10, 2) NOT NULL,
	"workstationCount" integer NOT NULL,
	"totalManpower" integer NOT NULL,
	"taktTime" numeric(10, 2),
	"taktPassRate" numeric(6, 2),
	"taktPassCount" integer,
	"upph" numeric(10, 4),
	"workstationsData" json NOT NULL,
	"bottleneckName" varchar(255),
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pla_production_lines" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"targetCycleTime" numeric(10, 2),
	"status" varchar(20) DEFAULT 'active' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pla_users" (
	"id" serial PRIMARY KEY NOT NULL,
	"openId" varchar(64) NOT NULL,
	"name" text,
	"email" varchar(320),
	"loginMethod" varchar(64),
	"role" varchar(20) DEFAULT 'user' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"lastSignedIn" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "pla_users_openId_unique" UNIQUE("openId")
);
--> statement-breakpoint
CREATE TABLE "pla_workstations" (
	"id" serial PRIMARY KEY NOT NULL,
	"productionLineId" integer NOT NULL,
	"name" varchar(255) NOT NULL,
	"sequenceOrder" integer DEFAULT 0 NOT NULL,
	"cycleTime" numeric(10, 2) NOT NULL,
	"manpower" integer DEFAULT 1 NOT NULL,
	"description" text,
	"notes" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
