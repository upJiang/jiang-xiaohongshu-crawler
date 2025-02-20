import time
from DrissionPage import Chromium
import pandas as pd


tab = Chromium().latest_tab 
tab.set.load_mode.none()
keyword = '万科万物研选家'
tab.get(f'https://www.xiaohongshu.com/search_result?keyword={keyword}&source=web_search_result_notes&type=51')


unique_hrefs = set()
num = 0
print('数据采集中')
while(True):
    div_list = tab.eles('.cover ld mask')
    for element_ in div_list:
        href_ = 'https://www.xiaohongshu.com/explore/' + element_.attrs['href'].split('/')[2]
        unique_hrefs.add(href_)  
    # 即时存储，避免脚本挂断
    if len(unique_hrefs)/10 > num: 
        df = pd.DataFrame(list(unique_hrefs), columns=['link'])
        df.to_excel('C:\\Users\\53027\\Desktop\\小红书爬虫文件\\链接0115.xlsx', index=False) 
        num += 1
    if len(unique_hrefs) >= 10: 
        break
    tab.scroll(800)
    end = tab.ele(' - THE END - ')
    if end:
        break
print('数据采集完毕')

data_list = []
num_s = 0
for link in list(unique_hrefs):
    tab.get(link)
    time.sleep(3) 

    content = tab.ele('.note-text')  
    note_content = content.text if content else ''     
    
    img_url = tab.ele('.img-container')
    img_link = img_url.child().attrs['src'] if img_url else ''

    pinglun_text = tab.ele('点击评论')
    comment_content = ''
    if pinglun_text:
        comment_content = '没有评论内容'
    else:
        note_text = tab.ele('.comments-el')
        comment_content = note_text.text if note_text else ''
    
    title = tab.ele('.title')
    username = tab.ele('.username')
    date_ = tab.ele('.date')

    data_list.append({
        '笔记标题': title.text if title else '',
        '笔记作者': username.text if username else '',
        '笔记时间': date_.text if date_ else '',
        '笔记链接': link,
        '笔记内容': note_content,
        '图片链接': img_link,
        '评论内容': comment_content
    })

    print("data_list",data_list)

    if len(data_list)/10 > num_s: 
        df = pd.DataFrame(data_list)
        df.to_excel('C:\\Users\\53027\\Desktop\\小红书爬虫文件\\舆情数据0115.xlsx', index=False) 
        num_s += 1
