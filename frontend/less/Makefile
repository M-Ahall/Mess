less = $(wildcard *.less)
_css  = $(less:.less=.css)
css  = $(addprefix ../css/, $(_css) )

../css/%.css: %.less theme.less
	lessc $< ../css/$@

all: $(css)

clean:
	rm -vf $(css)
