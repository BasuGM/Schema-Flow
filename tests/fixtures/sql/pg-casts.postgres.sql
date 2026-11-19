-- PostgreSQL defaults with multi-word cast types (QA-030).
CREATE TABLE public.casts (
    id integer NOT NULL,
    a character varying DEFAULT ''::character varying NOT NULL,
    b character varying(255) DEFAULT 'x'::character varying NOT NULL,
    c character varying[] DEFAULT '{}'::character varying[],
    d character varying(255)[] DEFAULT '{}'::character varying(255)[] NOT NULL,
    e timestamp without time zone DEFAULT '2020-01-01 00:00:00'::timestamp without time zone,
    f timestamp with time zone DEFAULT now() NOT NULL
);
