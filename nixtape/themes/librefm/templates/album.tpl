{include file='header.tpl'}

<h2>{$artist} - {$name}</h2>

<ul id="tracks">
  {section name=i loop=$tracks}
  <li>
      <a href="{$tracks[i]->getURL()}">{$tracks[i]->name}</a>
  </li>
  {/section}
</ul>
<div class="cleaner">&nbsp;</div>
{include file='footer.tpl'}