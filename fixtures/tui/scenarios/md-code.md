## 围栏代码块

```ts
export function greet(name: string): string {
	// tab 缩进 + 语法高亮
	const message = `hello, ${name}`;
	if (name.length > 10) {
		return message.toUpperCase();
	}
	return message;
}
```

```bash
$ curl -s https://pi.dev/api/latest-version
{"version":"0.84.1"}
```

行内代码 `npm install -g --ignore-scripts @earendil-works/pi-coding-agent` 与 `visibleWidth()`。

## 无语言标注围栏

```
raw fence without language tag
second line
```

## 波浪线围栏

~~~text
tilde fence content
~~~

## 分隔线

上方一段。

---

下方一段。

## 转义与行内

~~删除线~~ 与 **strong** 与 _emphasis_ 与 `codespan`。

公式行内 $E = mc^2$，块级：

$$
\int_0^\infty e^{-x^2} dx = \frac{\sqrt{\pi}}{2}
$$
