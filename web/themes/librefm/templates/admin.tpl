{include file='header.tpl'}

<h2>Admin panel</h2>
<hr>

{if isset($sent)}
<b>Email was sent successfully!</b>
{/if}
<b>Requests for invites</b>
<ul id="invites">
{section name=i loop=$emails}
  <li>
    <dl>
      <dt><a href="admin.php?action=invite&email={$emails[i].email|stripslashes|urlencode}">
        {$emails[i].email|stripslashes}</a> {if $emails.[i].status = 1} <b>INVITED</b>{if}</dt>
    </dl>
  </li>
{/section}
</ul>



{include file='footer.tpl'}
