# 海鸥 · DeepSeek Harness 全破 harness
# 常用目标：make install / verify / e2e / test / package

SHELL := /bin/bash
VERSION := $(shell cat VERSION 2>/dev/null || echo 0.0.0)
NAME := seagull-harness

.PHONY: help install install-dry verify e2e test test-ps lint package clean uninstall

help:
	@echo "$(NAME) v$(VERSION)"
	@echo ""
	@echo "  make install      一键安装（自动探测 DSH）"
	@echo "  make install-dry  只打印安装计划"
	@echo "  make verify       安装校验（真机）"
	@echo "  make e2e          端到端验证（真跑模型，需 API key）"
	@echo "  make test         CI 冒烟测试（假 DSH_HOME，不碰真机）"
	@echo "  make lint         静态检查（bash -n / shellcheck / py_compile / node --check）"
	@echo "  make package      打发布包 dist/$(NAME)-v$(VERSION).tar.gz"
	@echo "  make uninstall    卸载"
	@echo "  make clean        清理临时产物"

install:
	bash install.sh

install-dry:
	bash install.sh --dry-run

verify:
	bash verify.sh

e2e:
	bash verify-e2e.sh

test:
	bash tests/smoke.sh
	node --test tests/*.test.mjs

lint:
	@echo "── bash -n ──"
	@for f in install.sh verify.sh verify-e2e.sh tests/smoke.sh; do bash -n $$f && echo "  OK $$f"; done
	@echo "── python ──"
	@python -m py_compile src/tools/patch_profile.py && echo "  OK patch_profile.py"
	@echo "── node --check（vendor 插件入口）──"
	@if command -v node >/dev/null 2>&1; then \
	  for f in vendor/dsh-purge/bin/dsh-purge.js vendor/dsh-purge/lib/index.js vendor/dsh-purge/lib/core.js; do \
	    node --check $$f && echo "  OK $$f"; done; \
	else echo "  (跳过：没有 node)"; fi

package: lint test
	@mkdir -p dist
	@git archive --format=tar.gz --prefix=$(NAME)-v$(VERSION)/ -o dist/$(NAME)-v$(VERSION).tar.gz HEAD 2>/dev/null || \
	  tar czf dist/$(NAME)-v$(VERSION).tar.gz --exclude=_src --exclude=_verify --exclude=dist --exclude=.git .
	@echo "→ dist/$(NAME)-v$(VERSION).tar.gz"
	@sha256sum dist/$(NAME)-v$(VERSION).tar.gz 2>/dev/null || true

uninstall:
	bash install.sh --uninstall

clean:
	rm -rf dist __pycache__ src/tools/__pycache__ _verify .smoke-tmp.*
