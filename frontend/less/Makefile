less = $(wildcard *.less)
_css  = $(less:.less=.css)
css  = $(addprefix ../css/src/, $(_css) )

../css/src/%.css: %.less theme.less
	lessc $< $@

all: $(css)

clean:
	rm -vf $(css)
