ALTER TABLE public."user" ADD "admin" bool NOT NULL DEFAULT false;
UPDATE public."user" SET admin=true WHERE username='admin';
